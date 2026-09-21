import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export interface StaffPricingOptions {
  quoteId: string;
  status?: "quoted" | "under_review";
  offeredPrice?: number;
  validUntil?: string;
  staffNotes?: string;
  role?: "admin" | "manager";
}

const envPath = path.resolve(process.cwd(), ".env.local");
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if ((!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("placeholder")) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=");
      const val = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
      if (key.trim() === "NEXT_PUBLIC_SUPABASE_ANON_KEY") supabaseAnonKey = val;
    }
  }
}

/**
 * Authoritative Staff pricing action executed directly via Supabase Auth + RPC
 * under authentic Admin / Manager session claims, verifying production staff_respond_to_quote authorization.
 * NO NPX. NO CLI. 100% Native Supabase client.
 */
export async function executeStaffPricing(options: StaffPricingOptions): Promise<boolean> {
  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false }
  });

  const email = options.role === "manager" ? "mgr@test.local" : "admin@test.local";
  const { error: authErr } = await client.auth.signInWithPassword({
    email,
    password: "TestPassword123!"
  });

  if (authErr) {
    console.error("Staff sign-in error:", authErr);
    return false;
  }

  if (options.status === "under_review") {
    const reviewRes = await client.rpc("staff_respond_to_quote", {
      p_quote_id: options.quoteId,
      p_status: "under_review"
    });
    return !reviewRes.error;
  }

  // Attempt transition to under_review if currently 'new'
  await client.rpc("staff_respond_to_quote", {
    p_quote_id: options.quoteId,
    p_status: "under_review"
  });

  // Now transition under_review -> quoted with pricing details
  const quoteRes = await client.rpc("staff_respond_to_quote", {
    p_quote_id: options.quoteId,
    p_status: "quoted",
    p_offered_price: options.offeredPrice || null,
    p_valid_until: options.validUntil || null,
    p_staff_notes: options.staffNotes || null
  });

  if (quoteRes.error) {
    console.error("Staff pricing error:", quoteRes.error);
    return false;
  }

  return true;
}
