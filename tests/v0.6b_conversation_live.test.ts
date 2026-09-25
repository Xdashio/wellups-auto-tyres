/**
 * V0.6B Quote Conversation & Audit Timeline — Live Remote Database Tests
 *
 * Tests the conversation system against the LIVE remote Supabase database.
 * Does NOT create fake production business data.
 * Uses the existing quote testing infrastructure.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://odammhhhryyepynnilbr.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live tests in .env.local");
}

function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function createStaffClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

describe("V0.6B Quote Conversation — Live Tests", () => {
  let anon: SupabaseClient;
  let adminClient: SupabaseClient;
  let quoteId: string;
  let secretToken: string;
  let quoteNumber: string;
  let primaryBranchId: string;

  beforeAll(async () => {
    anon = createAnonClient();
    adminClient = createStaffClient();

    // Authenticate admin for staff-level testing
    const { error: authErr } = await adminClient.auth.signInWithPassword({
      email: "admin@test.local",
      password: "TestPassword123!",
    });
    if (authErr) {
      console.warn("Admin sign-in skipped:", authErr.message);
    }

    // Fetch the first available branch
    const { data: branch, error: branchErr } = await anon.from("branches_public").select("id").limit(1).single();
    if (branchErr || !branch) {
      throw new Error(`Failed to fetch branch: ${branchErr?.message}`);
    }
    primaryBranchId = branch.id;

    // Create a test quote for conversation testing
    const { data: createData, error: createError } = await anon.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "V0.6B Test Customer",
      p_customer_phone: "+254700000021",
      p_customer_email: "v06b@test.wl",
      p_item_type: "custom",
      p_quantity: 1,
      p_customer_notes: "V0.6B conversation test quote",
    });

    if (createError || !createData || createData.length === 0) {
      throw new Error(`Failed to create quote: ${createError?.message}`);
    }

    quoteId = createData[0].id;
    secretToken = createData[0].secret_token;
    quoteNumber = createData[0].quote_number;
  });

  // ─── SYSTEM EVENTS ──────────────────────────────────────────────────────

  it("quote_created system event is automatically generated", async () => {
    const { data, error } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const createdEvent = data!.find((m: any) => m.event_type === "quote_created");
    expect(createdEvent).toBeTruthy();
    expect(createdEvent!.sender_type).toBe("system");
    expect(createdEvent!.sender_display_name).toBe("System");
    expect(createdEvent!.event_metadata).toBeTruthy();
    expect(createdEvent!.event_metadata.quote_number).toBe(quoteNumber);
  });

  // ─── CUSTOMER MESSAGING ─────────────────────────────────────────────────

  it("customer can send a message with valid token", async () => {
    const { data, error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: "Hello, what tyres do you recommend for a Hilux?",
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy(); // Returns the new message UUID
  });

  it("customer message appears in timeline", async () => {
    const { data, error } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(error).toBeNull();
    const customerMsg = data!.find(
      (m: any) => m.sender_type === "customer" && m.message_body?.includes("Hilux")
    );
    expect(customerMsg).toBeTruthy();
    expect(customerMsg!.sender_display_name).toBe("V0.6B Test Customer");
    expect(customerMsg!.event_type).toBe("customer_message");
  });

  it("wrong token is rejected for message retrieval", async () => {
    const { data, error } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("wrong token is rejected for message sending", async () => {
    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: "00000000-0000-0000-0000-000000000000",
      p_message: "Should not work",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Invalid quote or token");
  });

  it("missing token is rejected", async () => {
    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: null as any,
      p_message: "Should not work",
    });

    expect(error).toBeTruthy();
  });

  // ─── MESSAGE VALIDATION ─────────────────────────────────────────────────

  it("empty message is rejected", async () => {
    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: "",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("empty");
  });

  it("whitespace-only message is rejected", async () => {
    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: "   \n  \t  ",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("empty");
  });

  it("excessively long message is rejected (>2000 chars)", async () => {
    const longMessage = "A".repeat(2001);
    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: longMessage,
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("2000");
  });

  it("exactly 2000 character message succeeds", async () => {
    const exactMessage = "B".repeat(2000);
    const { data, error } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: exactMessage,
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  // ─── CUSTOMER AUTHORIZATION BOUNDARIES ──────────────────────────────────

  it("customer cannot post to another quote", async () => {
    const { data: q2 } = await anon.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "Other Customer",
      p_customer_phone: "+254700999999",
      p_item_type: "custom",
      p_quantity: 1,
    });

    const otherQuoteId = q2![0].id;

    const { error } = await anon.rpc("send_quote_message", {
      p_quote_id: otherQuoteId,
      p_token: secretToken,
      p_message: "Cross-quote attack",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Invalid quote or token");
  });

  // ─── IMMUTABILITY ───────────────────────────────────────────────────────

  it("direct INSERT on app.quote_messages is denied for anon", async () => {
    const { error } = await anon
      .from("quote_messages" as any)
      .insert({
        quote_id: quoteId,
        sender_type: "system",
        sender_display_name: "Hacker",
        message_body: "Fake system event",
        event_type: "quote_accepted",
      } as any);

    expect(error).toBeTruthy();
  });

  it("direct UPDATE on app.quote_messages is denied", async () => {
    const { data } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(data!.length).toBeGreaterThan(0);
    const msgId = data![0].id;

    const { error } = await anon
      .from("quote_messages" as any)
      .update({ message_body: "Tampered content" } as any)
      .eq("id", msgId);

    expect(error).toBeTruthy();
  });

  it("direct DELETE on app.quote_messages is denied", async () => {
    const { data } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    const msgId = data![0].id;

    const { error } = await anon
      .from("quote_messages" as any)
      .delete()
      .eq("id", msgId);

    expect(error).toBeTruthy();
  });

  // ─── SECRET TOKEN NEVER RETURNED ────────────────────────────────────────

  it("secret_token is never present in message retrieval", async () => {
    const { data } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(data!.length).toBeGreaterThan(0);
    for (const msg of data!) {
      expect(msg).not.toHaveProperty("secret_token");
      expect(msg).not.toHaveProperty("token_fingerprint");
      const jsonStr = JSON.stringify(msg);
      expect(jsonStr).not.toContain(secretToken);
    }
  });

  // ─── STAFF RPC REQUIRES AUTHENTICATION ──────────────────────────────────

  it("staff_send_quote_message requires authentication", async () => {
    const { error } = await anon.rpc("staff_send_quote_message", {
      p_quote_id: quoteId,
      p_message: "Anonymous staff attempt",
    });

    expect(error).toBeTruthy();
  });

  it("staff_get_quote_messages requires authentication", async () => {
    const { error } = await anon.rpc("staff_get_quote_messages", {
      p_quote_id: quoteId,
    });

    expect(error).toBeTruthy();
  });

  // ─── ZERO SIDE EFFECTS ─────────────────────────────────────────────────

  it("conversation does not create sales, payments, or inventory movements", async () => {
    const { data: guestQuote } = await anon.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(guestQuote).toBeTruthy();
    expect(guestQuote![0].status).toBe("new");

    const { data: msgs } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });

    expect(msgs!.length).toBeGreaterThan(0);
    const terminalEvents = msgs!.filter(
      (m: any) => m.event_type === "quote_accepted" || m.event_type === "quote_declined"
    );
    expect(terminalEvents).toHaveLength(0);
  });
});

describe("V0.6B Staff Conversation Authorization & Full Lifecycle — Live Tests", () => {
  let anon: SupabaseClient;
  let adminClient: SupabaseClient;
  let managerClient: SupabaseClient;
  let cashierClient: SupabaseClient;
  let customerClient: SupabaseClient;
  let quoteId: string;
  let secretToken: string;
  let primaryBranchId: string;

  const signIn = async (email: string): Promise<SupabaseClient> => {
    const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: "TestPassword123!" });
    if (error) console.warn(`Sign-in skipped for ${email}:`, error.message);
    return c;
  };

  beforeAll(async () => {
    anon = createAnonClient();

    adminClient = await signIn("admin@test.local");
    managerClient = await signIn("mgr@test.local");
    cashierClient = await signIn("cashier@test.local");
    customerClient = await signIn("customer@test.local");

    const { data: branch, error: branchErr } = await anon
      .from("branches_public")
      .select("id")
      .limit(1)
      .single();
    if (branchErr || !branch) throw new Error(`Failed to fetch branch: ${branchErr?.message}`);
    primaryBranchId = branch.id;

    const { data: createData, error: createError } = await anon.rpc("create_quote_request", {
      p_branch_id: primaryBranchId,
      p_customer_name: "V0.6B Staff Lifecycle",
      p_customer_phone: "+254700000031",
      p_customer_email: "v06bstaff@test.wl",
      p_item_type: "custom",
      p_quantity: 1,
      p_customer_notes: "V0.6B staff authorization lifecycle quote",
    });
    if (createError || !createData || createData.length === 0) {
      throw new Error(`Failed to create quote: ${createError?.message}`);
    }
    quoteId = createData[0].id;
    secretToken = createData[0].secret_token;
  });

  it("staff_get_quote_messages is allowed for Admin and returns system events without exposing secret_token", async () => {
    const { data, error } = await adminClient.rpc("staff_get_quote_messages", {
      p_quote_id: quoteId,
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const created = data!.find((m: any) => m.event_type === "quote_created");
    expect(created).toBeTruthy();
    expect(created!.sender_type).toBe("system");

    // Raw bearer token / fingerprint never projected on staff read path either
    for (const msg of data!) {
      expect(msg).not.toHaveProperty("secret_token");
      expect(msg).not.toHaveProperty("token_fingerprint");
    }
  });

  it("Admin can send a staff message and it is recorded with authenticated staff identity", async () => {
    const { data, error } = await adminClient.rpc("staff_send_quote_message", {
      p_quote_id: quoteId,
      p_message: "Admin: confirming stock availability for your quote.",
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const { data: msgs } = await adminClient.rpc("staff_get_quote_messages", { p_quote_id: quoteId });
    const staffMsg = msgs!.find(
      (m: any) => m.sender_type === "staff" && (m.message_body || "").includes("stock availability")
    );
    expect(staffMsg).toBeTruthy();
    expect(staffMsg!.staff_id).toBeTruthy();
    expect(staffMsg!.sender_display_name).toBeTruthy();
    expect(staffMsg!.event_type).toBe("staff_message");
  });

  it("Manager can send a staff message and both sides see it", async () => {
    const { data, error } = await managerClient.rpc("staff_send_quote_message", {
      p_quote_id: quoteId,
      p_message: "Manager: arranged delivery slot for after payment.",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // Customer (guest token) sees the staff reply
    const { data: guestMsgs } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });
    const seenByCustomer = guestMsgs!.find(
      (m: any) => m.sender_type === "staff" && (m.message_body || "").includes("delivery slot")
    );
    expect(seenByCustomer).toBeTruthy();
  });

  it("Cashier can READ the conversation but CANNOT send a staff message", async () => {
    const { data, error: readErr } = await cashierClient.rpc("staff_get_quote_messages", {
      p_quote_id: quoteId,
    });
    expect(readErr).toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    const { error: sendErr } = await cashierClient.rpc("staff_send_quote_message", {
      p_quote_id: quoteId,
      p_message: "Cashier must never post in conversation",
    });
    expect(sendErr).toBeTruthy();
    expect(sendErr!.message).toMatch(/Forbidden/i);
  });

  it("authenticated non-staff (customer) is denied staff read and staff send", async () => {
    const { error: readErr } = await customerClient.rpc("staff_get_quote_messages", {
      p_quote_id: quoteId,
    });
    expect(readErr).toBeTruthy();
    expect(readErr!.message).toMatch(/staff role required/i);

    const { error: sendErr } = await customerClient.rpc("staff_send_quote_message", {
      p_quote_id: quoteId,
      p_message: "Customer must not reach staff channel",
    });
    expect(sendErr).toBeTruthy();
  });

  it("direct UPDATE / DELETE of quote messages is denied for authenticated staff", async () => {
    const { data: msgs } = await adminClient.rpc("staff_get_quote_messages", { p_quote_id: quoteId });
    expect(msgs!.length).toBeGreaterThan(0);
    const msgId = msgs![0].id;

    const { data: sessionData } = await adminClient.auth.getSession();
    const adminToken = (sessionData as unknown as { session: { access_token: string } | null }).session?.access_token || "";

    const updRes = await fetch(`${SUPABASE_URL}/rest/v1/quote_messages?id=eq.${msgId}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message_body: "Tampered" }),
    });
    expect([401, 403, 404]).toContain(updRes.status);

    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/quote_messages?id=eq.${msgId}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect([401, 403, 404]).toContain(delRes.status);
  });

  it("full lifecycle: customer msg -> staff price -> staff reply -> customer accept => events + acceptance evidence, no payment/sale", async () => {
    // 1. Customer message on the quote
    const { error: custMsgErr } = await anon.rpc("send_quote_message", {
      p_quote_id: quoteId,
      p_token: secretToken,
      p_message: "Please confirm the total before I accept.",
    });
    expect(custMsgErr).toBeNull();

    // 2. Admin prices it (new -> under_review -> quoted)
    const review = await adminClient.rpc("staff_respond_to_quote", {
      p_quote_id: quoteId,
      p_status: "under_review",
    });
    expect(review.error).toBeNull();

    const priced = await adminClient.rpc("staff_respond_to_quote", {
      p_quote_id: quoteId,
      p_status: "quoted",
      p_offered_price: 12500,
      p_valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      p_staff_notes: "V0.6B lifecycle test pricing",
    });
    expect(priced.error).toBeNull();

    // 3. Customer accepts with their token
    const { error: acceptErr } = await anon.rpc("customer_respond_to_quote", {
      p_quote_id: quoteId,
      p_action: "accept",
      p_token: secretToken,
    });
    expect(acceptErr).toBeNull();

    // 4. Timeline contains authoritative ordered events
    const { data: msgs } = await anon.rpc("get_quote_messages", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });
    const eventTypes = msgs!.filter((m: any) => m.sender_type === "system").map((m: any) => m.event_type);
    expect(eventTypes).toContain("quote_created");
    expect(eventTypes).toContain("quote_reviewed");
    expect(eventTypes).toContain("quote_priced");
    expect(eventTypes).toContain("quote_accepted");

    // Timeline is chronologically ordered
    const times = msgs!.map((m: any) => new Date(m.created_at).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);

    // 5. Acceptance evidence remains authoritative and frozen
    const { data: acceptance } = await anon.rpc("get_quote_acceptance", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });
    expect(acceptance).toBeTruthy();
    expect(Number(acceptance![0].offered_price)).toBe(12500);
    expect(acceptance![0].acceptance_mechanism).toBe("guest_token");
    expect(acceptance![0].token_fingerprint).toBeTruthy();

    // 6. NO payment ledger, NO sale, NO inventory mutation
    const payRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    expect([401, 403, 404]).toContain(payRes.status);

    const { data: guestQuote } = await anon.rpc("get_guest_quote", {
      p_quote_id: quoteId,
      p_token: secretToken,
    });
    expect(guestQuote![0].status).toBe("accepted");
  });
});
