import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { executeStaffPricing } from "./helpers/staff_admin";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Load .env.local if present
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

describe("GATE 010C Live Database Integration & Security Test Suite", () => {
  let primaryBranchId: string;
  let sampleProductId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch primary branch
    const { data: branchData, error: branchErr } = await anonClient
      .from("branches_public")
      .select("id")
      .limit(1)
      .single();

    if (branchErr || !branchData) {
      throw new Error(`Failed to fetch primary branch for live test: ${branchErr?.message}`);
    }
    primaryBranchId = branchData.id;

    // Fetch sample product
    const { data: prodData } = await anonClient
      .from("products_public")
      .select("id")
      .limit(1)
      .single();
    if (prodData) {
      sampleProductId = prodData.id;
    }
  });

  // =========================================================================
  // MANDATORY REGRESSION TEST: staff_respond_to_quote AUTHORIZATION MATRIX
  // =========================================================================
  it("MANDATORY REGRESSION: verifies staff_respond_to_quote authorization matrix across all actor roles", async () => {
    // Create a fresh disposable quote
    const { data: createData, error: createErr } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "Authorization Regression Test",
      p_customer_phone: "+254700123999",
      p_item_type: "product",
      p_product_id: sampleProductId
    });
    expect(createErr).toBeNull();
    const testQuoteId = createData[0].id;
    const testSecretToken = createData[0].secret_token;

    // 1. Anonymous guest with VALID secret token calls staff_respond_to_quote -> MUST BE DENIED
    const anonRes = await anonClient.rpc("staff_respond_to_quote", {
      p_quote_id: testQuoteId,
      p_status: "quoted",
      p_offered_price: 15000.0,
      p_valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      p_staff_notes: "Hostile anon price tampering"
    });
    expect(anonRes.error).toBeDefined();
    expect(anonRes.error?.message).toMatch(/permission denied for function staff_respond_to_quote/i);

    // 2. Authenticated customer with VALID secret token calls staff_respond_to_quote -> MUST BE DENIED
    const customerClaims = JSON.stringify({ sub: "dddddddd-dddd-dddd-dddd-dddddddddddd", app_metadata: {} }).replace(/"/g, '\\"');
    const customerSql = `
      set role authenticated;
      select set_config('request.jwt.claims', '${customerClaims}', false);
      select public.staff_respond_to_quote('${testQuoteId}'::uuid, 'quoted'::app.quote_status, 12000.0, (now() + interval '7 days'), 'Customer pricing attempt');
    `;
    let customerError = "";
    try {
      execSync(`npx supabase db query --linked "${customerSql}"`, { encoding: "utf-8" });
    } catch (e: any) {
      customerError = `${e.stdout || ""} ${e.stderr || ""} ${e.message || ""}`;
    }
    expect(customerError).toMatch(/Forbidden: Only Admin and Manager roles are authorized to manage quote pricing/i);

    // 3. Cashier calls staff_respond_to_quote -> MUST BE DENIED
    const cashierClaims = JSON.stringify({ sub: "cccccccc-cccc-cccc-cccc-cccccccccccc", app_metadata: { user_role: "cashier" } }).replace(/"/g, '\\"');
    const cashierSql = `
      set role authenticated;
      select set_config('request.jwt.claims', '${cashierClaims}', false);
      select public.staff_respond_to_quote('${testQuoteId}'::uuid, 'quoted'::app.quote_status, 12000.0, (now() + interval '7 days'), 'Cashier pricing attempt');
    `;
    let cashierError = "";
    try {
      execSync(`npx supabase db query --linked "${cashierSql}"`, { encoding: "utf-8" });
    } catch (e: any) {
      cashierError = `${e.stdout || ""} ${e.stderr || ""} ${e.message || ""}`;
    }
    expect(cashierError).toMatch(/Forbidden: Only Admin and Manager roles are authorized to manage quote pricing/i);

    // 4. Manager calls staff_respond_to_quote -> MUST BE ALLOWED
    const managerSuccess = executeStaffPricing({
      quoteId: testQuoteId,
      status: "quoted",
      offeredPrice: 16500.0,
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      staffNotes: "Approved Manager quote pricing",
      role: "manager"
    });
    expect(managerSuccess).toBe(true);

    // 5. Admin calls staff_respond_to_quote -> MUST BE ALLOWED
    const adminSuccess = executeStaffPricing({
      quoteId: testQuoteId,
      status: "quoted",
      offeredPrice: 17500.0,
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      staffNotes: "Approved Admin quote pricing revision",
      role: "admin"
    });
    expect(adminSuccess).toBe(true);
  });

  // =========================================================================
  // LIFECYCLE 1: COMPLETE LIVE ACCEPTANCE FLOW
  // =========================================================================
  it("Lifecycle 1: guest create -> admin/manager price -> quoted -> guest retrieve -> guest accept -> DB accepted", async () => {
    // 1. Guest creates quote
    const { data: createData, error: createErr } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "DISPOSABLE TEST GUEST (ACCEPT)",
      p_customer_phone: "+254700000001",
      p_item_type: "product",
      p_product_id: sampleProductId,
      p_quantity: 4,
      p_customer_notes: "Live acceptance flow disposable quote"
    });

    expect(createErr).toBeNull();
    const quoteId = createData[0].id;
    const secretToken = createData[0].secret_token;

    // 2. Staff (Admin/Manager) legitimately prices the quote
    const validUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const priceSuccess = executeStaffPricing({
      quoteId,
      status: "quoted",
      offeredPrice: 18500.0,
      validUntil,
      staffNotes: "Staff discount set of 4 tyres",
      role: "admin"
    });
    expect(priceSuccess).toBe(true);

    // 3. Guest retrieves quote via public.get_guest_quote(quoteId, secretToken)
    const { data: guestData, error: guestErr } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken
    });

    expect(guestErr).toBeNull();
    expect(guestData).toBeDefined();
    expect(guestData.length).toBe(1);
    expect(guestData[0].id).toBe(quoteId);
    expect(guestData[0].status).toBe("quoted");
    expect(Number(guestData[0].offered_price)).toBe(18500.0);

    // Verify secret token is NOT returned in public guest view payload
    expect(guestData[0]).not.toHaveProperty("secret_token");

    // 4. Guest accepts quote via customer_respond_to_quote
    const { data: acceptData, error: acceptErr } = await anonClient.rpc("customer_respond_to_quote", {
      p_quote_id: quoteId,
      p_action: "accept",
      p_token: secretToken
    });
    expect(acceptErr).toBeNull();
    expect(acceptData).toBe(true);

    // 5. Verify final DB status = 'accepted'
    const { data: verifyData } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken
    });
    expect(verifyData[0].status).toBe("accepted");
  });

  // =========================================================================
  // LIFECYCLE 2: COMPLETE LIVE DECLINE FLOW
  // =========================================================================
  it("Lifecycle 2: guest create -> admin/manager price -> quoted -> guest retrieve -> guest decline -> DB declined", async () => {
    // 1. Guest creates quote
    const { data: createData, error: createErr } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "DISPOSABLE TEST GUEST (DECLINE)",
      p_customer_phone: "+254700000002",
      p_item_type: "product",
      p_product_id: sampleProductId,
      p_quantity: 2
    });

    expect(createErr).toBeNull();
    const quoteId = createData[0].id;
    const secretToken = createData[0].secret_token;

    // 2. Staff prices quote
    const priceSuccess = executeStaffPricing({
      quoteId,
      status: "quoted",
      offeredPrice: 14000.0,
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      role: "manager"
    });
    expect(priceSuccess).toBe(true);

    // 3. Guest retrieves quote
    const { data: guestData } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken
    });
    expect(guestData[0].status).toBe("quoted");

    // 4. Guest declines quote
    const { data: declineData, error: declineErr } = await anonClient.rpc("customer_respond_to_quote", {
      p_quote_id: quoteId,
      p_action: "decline",
      p_token: secretToken
    });
    expect(declineErr).toBeNull();
    expect(declineData).toBe(true);

    // 5. Verify final DB status = 'declined'
    const { data: finalData } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken
    });
    expect(finalData[0].status).toBe("declined");
  });

  // =========================================================================
  // LIFECYCLE 3: COMPLETE LIVE EXPIRY FLOW
  // =========================================================================
  it("Lifecycle 3: guest create -> staff price with past valid_until -> guest accept attempt -> rejected -> DB expired", async () => {
    // 1. Guest creates quote
    const { data: createData } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "DISPOSABLE TEST GUEST (EXPIRY)",
      p_customer_phone: "+254700000003",
      p_item_type: "product",
      p_quantity: 1
    });

    const quoteId = createData[0].id;
    const secretToken = createData[0].secret_token;

    // 2. Staff prices quote with expired date (1 year in the past)
    const pastDate = new Date(Date.now() - 365 * 86400000).toISOString();
    const priceSuccess = executeStaffPricing({
      quoteId,
      status: "quoted",
      offeredPrice: 11000.0,
      validUntil: pastDate,
      role: "admin"
    });
    expect(priceSuccess).toBe(true);

    // 3. Customer attempts to accept expired quote -> rejection
    const { error: acceptErr } = await anonClient.rpc("customer_respond_to_quote", {
      p_quote_id: quoteId,
      p_action: "accept",
      p_token: secretToken
    });

    expect(acceptErr).toBeDefined();
    expect(acceptErr?.message).toContain("Quote has expired and can no longer be accepted");

    // 4. Verify final DB state is updated to 'expired'
    const { data: finalData } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken
    });
    expect(finalData[0].status).toBe("expired");
  });

  // =========================================================================
  // DIRECT POSTGREST DATABASE BYPASS
  // =========================================================================
  it("verifies direct PostgREST table access to app.quote_requests is rejected or unexposed", async () => {
    // 1. Direct SELECT on app.quote_requests
    const resSelect = await fetch(`${supabaseUrl}/rest/v1/quote_requests`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
    });
    expect([401, 403, 404]).toContain(resSelect.status);

    // 2. Direct INSERT on app.quote_requests
    const resInsert = await fetch(`${supabaseUrl}/rest/v1/quote_requests`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ customer_name: "Hacker", customer_phone: "+254700000000" })
    });
    expect([401, 403, 404]).toContain(resInsert.status);

    // 3. Direct UPDATE on app.quote_requests
    const resUpdate = await fetch(`${supabaseUrl}/rest/v1/quote_requests?id=eq.00000000-0000-0000-0000-000000000000`, {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ offered_price: 1.0 })
    });
    expect([401, 403, 404]).toContain(resUpdate.status);

    // 4. Direct DELETE on app.quote_requests
    const resDelete = await fetch(`${supabaseUrl}/rest/v1/quote_requests?id=eq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }
    });
    expect([401, 403, 404]).toContain(resDelete.status);
  });

  // =========================================================================
  // PROTECTED FIELD TAMPERING
  // =========================================================================
  it("rejects invalid customer_respond_to_quote action parameter and parameter tampering", async () => {
    const { error } = await anonClient.rpc("customer_respond_to_quote", {
      p_quote_id: "00000000-0000-0000-0000-000000000000",
      p_action: "hack_price" as any,
      p_token: "00000000-0000-0000-0000-000000000000"
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain("Invalid action. Must be accept or decline.");
  });

  // =========================================================================
  // CREATE RPC HARDENING
  // =========================================================================
  it("rejects create_quote_request missing required customer name or phone", async () => {
    const { error: errNoName } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "",
      p_customer_phone: "+254700000000"
    });
    expect(errNoName).toBeDefined();
    expect(errNoName?.message).toContain("Customer name is required");

    const { error: errNoPhone } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "John Doe",
      p_customer_phone: "   "
    });
    expect(errNoPhone).toBeDefined();
    expect(errNoPhone?.message).toContain("Customer phone number is required");
  });

  // =========================================================================
  // GUEST TOKEN FORMAT & ISOLATION
  // =========================================================================
  it("generates valid UUID v4 secret tokens and isolates quotes by token", async () => {
    const { data: createData } = await anonClient.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "DISPOSABLE TEST GUEST (TOKEN ISOLATION)",
      p_customer_phone: "+254700000099"
    });

    const quoteId = createData[0].id;
    const token = createData[0].secret_token;

    // UUID v4 format verification
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidRegex);

    // Wrong token returns zero rows
    const wrongToken = "00000000-0000-4000-a000-000000000000";
    const { data: wrongData } = await anonClient.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: wrongToken
    });
    expect(wrongData).toEqual([]);
  });

  // =========================================================================
  // V0.1/V0.2 SECURITY REGRESSION
  // =========================================================================
  it("verifies public catalog views omit internal cost_price and margin fields", async () => {
    const { data: products } = await anonClient.from("products_public").select("*").limit(1);
    expect(products).toBeDefined();
    if (products && products.length > 0) {
      expect(products[0]).not.toHaveProperty("cost_price");
      expect(products[0]).not.toHaveProperty("margin");
    }

    const { data: branches } = await anonClient.from("branches_public").select("*").limit(1);
    expect(branches).toBeDefined();
    if (branches && branches.length > 0) {
      expect(branches[0]).not.toHaveProperty("cost_price");
      expect(branches[0]).not.toHaveProperty("margin");
    }
  });
});
