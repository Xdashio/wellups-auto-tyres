import { describe, it, expect } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { listProductsForAdmin, listServicesForAdmin, listCategoriesForAdmin } from "../lib/supabase/catalog-admin";
import { getBranchForAdmin } from "../lib/supabase/branch";
import { listStaffForAdmin } from "../lib/supabase/staff-admin";

// GATE 023 live verification of the S1 read-path repair, against the
// linked Supabase project (migrations 001–017 applied).
//
// What is proven here — at the PostgREST/RLS boundary, exactly where the
// repaired server actions read:
//   1. authenticated Admin reads all five protected projections
//   2. anon is denied on all of them (42501-class failures surface as
//      kind:"unauthorized", never as a fake-empty list)
//   3. non-admin authenticated staff remain denied: the staff RPC fails
//      closed with 42501, and the admin-predicate views filter manager/
//      cashier to zero visible rows
//
// No rows are created anywhere: for the intentionally empty catalogue the
// Admin assertions prove ok:true + [] (authenticated valid empty), and the
// real branch row is read-only evidence of a working settings read.
//
// PRECONDITION: .env.local with NEXT_PUBLIC_SUPABASE_ANON_KEY (loaded by
// this file) and the seeded staff test accounts (admin/mgr/cashier@
// test.local). Run: npx vitest run tests/admin_read_paths_live.test.ts
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
let managerClient: SupabaseClient;
let cashierClient: SupabaseClient;

// Staff-roster availability, probed as the Admin caller. Observed live
// states during GATE 023: first PGRST202 (function absent), then — after
// an external mid-gate push of 017 — 42804 "structure of query does not
// match function result type". In both states the admin roster read cannot
// certify anything, so the dedicated precondition test fails closed on
// this probe and the roster assertion is marked skipped, never passed.
// Repairing the deployed function needs a new migration + deploy, both
// outside this gate's rules (no migration changes, no deploys).
//
// Probed at MODULE SCOPE below, before vitest collects the tests: it.runIf
// evaluates its condition at collection time, i.e. before any beforeAll
// hook could set a flag. Non-null until the probe completes so the gate
// fails closed even if the probe never runs.
let staffRosterBlocker: string | null = "roster availability probe did not run";

async function signIn(email: string): Promise<SupabaseClient | null> {
  const client = createClient(supabaseUrl, supabaseAnonKey!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "TestPassword123!",
  });
  if (error) {
    return null;
  }
  return client;
}

// These three accounts are a hard precondition of this suite (they exist:
// the staff_admin and admin_write_paths live suites depend on them too).
async function requireSignIn(email: string): Promise<SupabaseClient> {
  const client = await signIn(email);
  if (!client) throw new Error(`live: required sign-in failed for ${email}`);
  return client;
}

// Hard precondition: the three seeded staff accounts. A failed sign-in
// throws at module load and fails the whole file (never a silent skip).
anonClient = createClient(supabaseUrl, supabaseAnonKey!);
adminClient = await requireSignIn("admin@test.local");
managerClient = await requireSignIn("mgr@test.local");
cashierClient = await requireSignIn("cashier@test.local");
const rosterProbe = await listStaffForAdmin(adminClient);
staffRosterBlocker = rosterProbe.ok ? null : `${rosterProbe.kind}: ${rosterProbe.message}`;

describe("GATE 023 live — authenticated Admin reads (S1 repair, positive path)", () => {
  it("Admin reads products_admin through a token-scoped client", async () => {
    const res = await listProductsForAdmin(adminClient);
    expect(res.ok).toBe(true);
    // Catalogue is intentionally empty: ok + [] is the honest empty result
    // that must never be confusable with a swallowed denial.
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("Admin reads services_admin (active + disabled projection)", async () => {
    const res = await listServicesForAdmin(adminClient);
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("Admin reads categories_admin", async () => {
    const res = await listCategoriesForAdmin(adminClient);
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("Admin reads the real branch configuration from branches_admin", async () => {
    const res = await getBranchForAdmin(adminClient);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Real business row must come back — this is the read that used to
      // render "Branch Configuration Not Found" for everyone.
      expect(res.data).not.toBeNull();
      expect(res.data!.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.data!.name.length).toBeGreaterThan(0);
    }
  });

  it("admin_list_staff roster read works for Admin (fail-closed precondition)", async () => {
    // Fails while the live deployment of admin_list_staff cannot return a
    // roster (observed: 42804 structure mismatch after the mid-gate 017
    // push; PGRST202 before it). Repairing it needs a new migration and a
    // deploy — both outside this gate's rules — so the roster
    // certification stays pending: reported as unavailable, never passed.
    const res = await listStaffForAdmin(adminClient);
    expect(
      res.ok,
      `admin roster read failed live (${staffRosterBlocker ?? "unknown"}) — staff read path cannot be certified until the deployed admin_list_staff is repaired`
    ).toBe(true);
  });

  it.runIf(staffRosterBlocker === null)("Admin reads the staff roster through admin_list_staff", async () => {
    const res = await listStaffForAdmin(adminClient);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray(res.data)).toBe(true);
      // Projection hygiene: never leaks auth internals.
      for (const row of res.data) {
        expect(row).not.toHaveProperty("encrypted_password");
      }
    }
  });
});

describe("GATE 023 live — anon cannot read any protected admin projection", () => {
  it("anon products_admin read -> unauthorized (never [])", async () => {
    const res = await listProductsForAdmin(anonClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.kind).toBe("unauthorized");
  });

  it("anon services_admin read -> unauthorized", async () => {
    const res = await listServicesForAdmin(anonClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.kind).toBe("unauthorized");
  });

  it("anon categories_admin read -> unauthorized", async () => {
    const res = await listCategoriesForAdmin(anonClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.kind).toBe("unauthorized");
  });

  it("anon branches_admin read -> unauthorized (016 revoke, 42501)", async () => {
    const res = await getBranchForAdmin(anonClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.kind).toBe("unauthorized");
      expect(res.message).toMatch(/permission denied/i);
    }
  });

  // Unconditional in the current deployed state: anon fails on the 017
  // execute revoke and non-admins fail on the in-body role check — both
  // happen BEFORE the query that raises 42804, so these denials hold
  // independently of the broken admin roster read.
  it("anon admin_list_staff read -> denied (017 execute revoke)", async () => {
    const res = await listStaffForAdmin(anonClient);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.kind).toBe("unauthorized");
  });
});

describe("GATE 023 live — unauthorized roles remain denied", () => {
  it("manager and cashier see zero branch rows (admin predicate filters)", async () => {
    for (const client of [managerClient, cashierClient]) {
      const res = await getBranchForAdmin(client);
      // SELECT grant admits them; request_role() = 'admin' filters every
      // row away. Valid request, zero visible rows — no branch fields leak,
      // while the Admin read above proves the row exists.
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toBeNull();
    }
  });

  it("manager and cashier see zero rows on products/services/categories_admin", async () => {
    for (const client of [managerClient, cashierClient]) {
      const products = await listProductsForAdmin(client);
      expect(products.ok).toBe(true);
      if (products.ok) expect(products.data).toHaveLength(0);

      const services = await listServicesForAdmin(client);
      expect(services.ok).toBe(true);
      if (services.ok) expect(services.data).toHaveLength(0);

      const categories = await listCategoriesForAdmin(client);
      expect(categories.ok).toBe(true);
      if (categories.ok) expect(categories.data).toHaveLength(0);
    }
  });

  // Unconditional: the in-body role check raises 42501 before the roster
  // query runs, so non-admin denial does not depend on the 42804 defect.
  it("manager and cashier are denied the staff roster (RPC fail-closed 42501)", async () => {
    for (const client of [managerClient, cashierClient]) {
      const res = await listStaffForAdmin(client);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.kind).toBe("unauthorized");
    }
  });
});
