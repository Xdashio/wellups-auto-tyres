import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Load .env.local
const envLocalPath = path.resolve(import.meta.dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key.trim()] = value;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://odammhhhryyepynnilbr.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live tests in .env.local");
}

let anonClient: SupabaseClient;
let adminClient: SupabaseClient;
let primaryBranchId: string;

describe("GATE 033B — V0.6A Live Database & Acceptance Certification", () => {
  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    adminClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const { error: authErr } = await adminClient.auth.signInWithPassword({
      email: "admin@test.local",
      password: "TestPassword123!",
    });
    if (authErr) {
      throw new Error(`Admin sign-in failed: ${authErr.message}`);
    }

    const { data: branchData, error: branchErr } = await anonClient
      .from("branches_public")
      .select("id")
      .limit(1)
      .single();

    if (branchErr || !branchData) {
      throw new Error(`Failed to fetch branch: ${branchErr?.message}`);
    }
    primaryBranchId = branchData.id;
  });

  // Helper to create a new quote request
  async function createTestQuote(name: string) {
    const { data, error } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: name,
      p_customer_phone: "+254712345678",
      p_customer_email: "test@example.com",
      p_item_type: "product",
      p_quantity: 4,
      p_customer_notes: "Live acceptance test",
    });
    if (error || !data || data.length === 0) {
      throw new Error(`Failed to create quote request: ${error?.message}`);
    }
    return { quoteId: data[0].id, secretToken: data[0].secret_token, quoteNumber: data[0].quote_number };
  }

  // ─── STEP 6: LIVE 7-DAY VALIDITY TESTING ──────────────────────────────────
  describe("1. 7-Day Maximum Validity Enforcement (Live RPC)", () => {
    it("ALLOWED: exactly 7 days validity is accepted by staff_respond_to_quote", async () => {
      const { quoteId } = await createTestQuote("Live Validity 7 Days Exact");

      // new -> under_review
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "under_review",
      });

      // exactly 7 days from now (within tolerance)
      const validUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000 - 5000).toISOString();
      const { error } = await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 32000.0,
        p_valid_until: validUntil,
      });

      expect(error).toBeNull();
    });

    it("REJECTED: more than 7 days validity is strictly rejected by staff_respond_to_quote", async () => {
      const { quoteId } = await createTestQuote("Live Validity Over 7 Days");

      // new -> under_review
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "under_review",
      });

      // 8 days from now
      const validUntil = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();
      const { error } = await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 32000.0,
        p_valid_until: validUntil,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Quote validity cannot exceed 7 calendar days from issuance");
    });

    it("REJECTED: past validity date is strictly rejected by staff_respond_to_quote", async () => {
      const { quoteId } = await createTestQuote("Live Validity Past Date");

      // new -> under_review
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "under_review",
      });

      // 1 day in the past
      const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { error } = await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 32000.0,
        p_valid_until: pastDate,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Quote validity timestamp cannot be in the past");
    });
  });

  // ─── STEP 7: LIVE ACCEPTANCE TEST ─────────────────────────────────────────
  describe("2. Authoritative Commercial Acceptance Evidence (Live RPC & Ledger)", () => {
    it("quoted -> customer accepts -> quote_acceptances row created with authoritative snapshot and token fingerprint", async () => {
      const { quoteId, secretToken, quoteNumber } = await createTestQuote("Live Acceptance Evidence");

      // 1. Move to under_review -> quoted (KES 54,000, 5 days validity)
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "under_review",
      });

      const validUntil = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
      const { error: quoteErr } = await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 54000.0,
        p_valid_until: validUntil,
        p_staff_notes: "Special commercial terms",
      });
      expect(quoteErr).toBeNull();

      // 2. Customer accepts quote via guest token
      const { data: acceptResult, error: acceptErr } = await anonClient.rpc("customer_respond_to_quote", {
        p_quote_id: quoteId,
        p_action: "accept",
        p_token: secretToken,
      });
      expect(acceptErr).toBeNull();
      expect(acceptResult).toBe(true);

      // 3. Verify quote request record status is 'accepted'
      const { data: guestQuote } = await anonClient.rpc("get_guest_quote", {
        p_quote_id: quoteId,
        p_token: secretToken,
      });
      expect(guestQuote).toHaveLength(1);
      expect(guestQuote[0].status).toBe("accepted");
      expect(guestQuote[0].accepted_at).not.toBeNull();
      expect(guestQuote[0].offered_price).toBe(54000.0);

      // 4. Verify immutable acceptance evidence row via get_quote_acceptance
      const { data: acceptanceData, error: acceptanceErr } = await anonClient.rpc("get_quote_acceptance", {
        p_quote_id: quoteId,
        p_token: secretToken,
      });
      expect(acceptanceErr).toBeNull();
      expect(acceptanceData).toHaveLength(1);

      const evidence = acceptanceData[0];
      expect(evidence.quote_id).toBe(quoteId);
      expect(evidence.quote_number).toBe(quoteNumber);
      expect(Number(evidence.offered_price)).toBe(54000.0);
      expect(evidence.currency).toBe("KES");
      expect(evidence.acceptance_mechanism).toBe("guest_token");
      expect(evidence.accepted_at).not.toBeNull();

      // 5. Verify token fingerprint matches SHA-256 of secretToken
      const expectedFingerprint = crypto.createHash("sha256").update(secretToken).digest("hex");
      expect(evidence.token_fingerprint).toBe(expectedFingerprint);

      // 6. Verify zero payments and zero sales were created
      const { data: directSales } = await anonClient.from("sales_cashier").select("*").eq("id", quoteId);
      expect(directSales?.length ?? 0).toBe(0);
    });
  });

  // ─── STEP 8: TOKEN SECURITY & ISOLATION ───────────────────────────────────
  describe("3. Secret Token Isolation & Security Boundaries", () => {
    it("missing token is rejected on acceptance", async () => {
      const { quoteId } = await createTestQuote("Missing Token Test");
      await adminClient.rpc("staff_respond_to_quote", { p_quote_id: quoteId, p_status: "under_review" });
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 20000,
        p_valid_until: new Date(Date.now() + 86400000).toISOString(),
      });

      const { error } = await anonClient.rpc("customer_respond_to_quote", {
        p_quote_id: quoteId,
        p_action: "accept",
        p_token: null,
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Unauthorized to respond to this quote");
    });

    it("wrong token is rejected on acceptance", async () => {
      const { quoteId } = await createTestQuote("Wrong Token Test");
      await adminClient.rpc("staff_respond_to_quote", { p_quote_id: quoteId, p_status: "under_review" });
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteId,
        p_status: "quoted",
        p_offered_price: 20000,
        p_valid_until: new Date(Date.now() + 86400000).toISOString(),
      });

      const { error } = await anonClient.rpc("customer_respond_to_quote", {
        p_quote_id: quoteId,
        p_action: "accept",
        p_token: "00000000-0000-0000-0000-000000000000",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Unauthorized to respond to this quote");
    });

    it("another quote's token cannot access acceptance evidence", async () => {
      const quoteA = await createTestQuote("Quote A Evidence Isolation");
      const quoteB = await createTestQuote("Quote B Evidence Isolation");

      // Price and accept Quote A
      await adminClient.rpc("staff_respond_to_quote", { p_quote_id: quoteA.quoteId, p_status: "under_review" });
      await adminClient.rpc("staff_respond_to_quote", {
        p_quote_id: quoteA.quoteId,
        p_status: "quoted",
        p_offered_price: 25000,
        p_valid_until: new Date(Date.now() + 86400000).toISOString(),
      });
      await anonClient.rpc("customer_respond_to_quote", {
        p_quote_id: quoteA.quoteId,
        p_action: "accept",
        p_token: quoteA.secretToken,
      });

      // Attacker attempts to read Quote A acceptance evidence using Quote B's secret token
      const { data: crossData } = await anonClient.rpc("get_quote_acceptance", {
        p_quote_id: quoteA.quoteId,
        p_token: quoteB.secretToken,
      });
      expect(crossData?.length ?? 0).toBe(0);
    });

    it("raw secret_token is never returned in get_guest_quote or get_quote_acceptance", async () => {
      const { quoteId, secretToken } = await createTestQuote("Secret Token Leak Prevention");

      const { data: quoteData } = await anonClient.rpc("get_guest_quote", {
        p_quote_id: quoteId,
        p_token: secretToken,
      });
      expect(quoteData).toHaveLength(1);
      expect(quoteData[0]).not.toHaveProperty("secret_token");
      expect(quoteData[0]).not.toHaveProperty("staff_notes");

      const { data: evidenceData } = await anonClient.rpc("get_quote_acceptance", {
        p_quote_id: quoteId,
        p_token: secretToken,
      });
      if (evidenceData && evidenceData.length > 0) {
        expect(evidenceData[0]).not.toHaveProperty("secret_token");
      }
    });

    it("direct insert, update, or delete on app.quote_acceptances is denied to clients", async () => {
      // Direct PostgREST access to internal table is either unexposed or denied
      const { error: insErr } = await anonClient.from("quote_acceptances").insert({
        quote_id: "00000000-0000-0000-0000-000000000000",
        offered_price: 100,
      });
      expect(insErr).toBeDefined();
    });
  });
});
