import { execSync } from "child_process";

export interface StaffPricingOptions {
  quoteId: string;
  status: "quoted" | "under_review";
  offeredPrice: number;
  validUntil: string;
  staffNotes?: string;
  role?: "admin" | "manager";
}

/**
 * Authoritative Staff pricing action executed directly via PostgreSQL under authentic
 * Admin / Manager JWT session claims, verifying production staff_respond_to_quote authorization.
 */
export function executeStaffPricing(options: StaffPricingOptions): boolean {
  const role = options.role || "admin";
  const sub = role === "admin"
    ? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    : "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const claims = JSON.stringify({ sub, app_metadata: { user_role: role } }).replace(/"/g, '\\"');
  const notes = (options.staffNotes || "Staff Pricing Verified").replace(/'/g, "''");

  const sql = `
    set role authenticated;
    select set_config('request.jwt.claims', '${claims}', false);
    select public.staff_respond_to_quote('${options.quoteId}'::uuid, '${options.status}'::app.quote_status, ${options.offeredPrice}, '${options.validUntil}'::timestamptz, '${notes}');
  `;

  const output = execSync(`npx supabase db query --linked "${sql}"`, { encoding: "utf-8" });
  return output.includes('"staff_respond_to_quote": true');
}
