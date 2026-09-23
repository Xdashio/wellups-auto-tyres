import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  classifyReadError,
  readFailure,
} from "../lib/supabase/scoped-client";
import {
  listProductsForAdmin,
  listServicesForAdmin,
  listCategoriesForAdmin,
} from "../lib/supabase/catalog-admin";
import { getBranchForAdmin } from "../lib/supabase/branch";
import { listStaffForAdmin } from "../lib/supabase/staff-admin";

// GATE 023 — regression suite for defect S1 (admin server-side reads using
// the anon client with failures swallowed into [] / null). Three layers:
//   1. error classification (unauthorized vs unexpected failure)
//   2. the typed read helpers never collapse a failure into a fake-empty
//      result, and a genuine empty result stays an honest ok + []
//   3. source audit: the four repaired pages keep the token-scoped path
//      and never regress to publicSupabase reads of admin projections
const readSrc = (rel: string): string =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

// ─── 1. Classification ────────────────────────────────────────────────

describe("GATE 023 unit — read-error classification", () => {
  it("maps privilege and identity failures to unauthorized", () => {
    expect(
      classifyReadError({ code: "42501", message: "permission denied for view products_admin" })
    ).toBe("unauthorized");
    expect(classifyReadError({ code: "42503", message: "insufficient privilege" })).toBe(
      "unauthorized"
    );
    expect(classifyReadError({ code: "PGRST301", message: "JWT expired" })).toBe("unauthorized");
    expect(classifyReadError({ code: "401", message: "unauthenticated" })).toBe("unauthorized");
    expect(
      classifyReadError({ code: null, message: "permission denied for function admin_list_staff" })
    ).toBe("unauthorized");
    expect(
      classifyReadError({ code: null, message: "forbidden: admin only" })
    ).toBe("unauthorized"); // 017 RPC denial phrasing without SQLSTATE
  });

  it("maps unexpected database failures to error (never unauthorized)", () => {
    expect(classifyReadError({ code: "XX000", message: "internal error" })).toBe("error");
    expect(classifyReadError({ code: "57014", message: "canceling statement due to timeout" })).toBe(
      "error"
    );
    expect(classifyReadError({ code: null, message: "TypeError: fetch failed" })).toBe("error");
  });

  it("readFailure preserves the original database message for the UI", () => {
    const f = readFailure({ code: "42501", message: "permission denied for view branches_admin" });
    expect(f).toEqual({
      ok: false,
      kind: "unauthorized",
      message: "permission denied for view branches_admin",
    });
  });
});

// ─── 2. Typed read helpers ────────────────────────────────────────────

type Result<T> = { ok: true; data: T } | { ok: false; kind: string; message: string };

// Mirrors the PostgREST builder chains the helpers actually use.
const listClient = (result: { data: unknown; error: unknown }) =>
  ({
    from: () => ({ select: () => ({ order: async () => result }) }),
  }) as never;

const branchClient = (result: { data: unknown; error: unknown }) =>
  ({
    from: () => ({
      select: () => ({ limit: () => ({ maybeSingle: async () => result }) }),
    }),
  }) as never;

const rpcClient = (result: { data: unknown; error: unknown }) =>
  ({ rpc: async () => result }) as never;

const ANON_42501 = { code: "42501", message: "permission denied for view products_admin" };

describe("GATE 023 unit — admin read helpers return typed results", () => {
  it("listProductsForAdmin: 42501 denial -> unauthorized, not []", async () => {
    const res = await listProductsForAdmin(listClient({ data: null, error: ANON_42501 }));
    expect(res).toEqual({ ok: false, kind: "unauthorized", message: ANON_42501.message });
  });

  it("listProductsForAdmin: authenticated zero rows -> honest ok + []", async () => {
    const res: Result<unknown> = await listProductsForAdmin(listClient({ data: [], error: null }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it("listProductsForAdmin: unexpected DB failure -> error, not []", async () => {
    const res = await listProductsForAdmin(
      listClient({ data: null, error: { code: "XX000", message: "boom" } })
    );
    expect(res).toEqual({ ok: false, kind: "error", message: "boom" });
  });

  it("listServicesForAdmin: denial -> unauthorized; empty -> ok + []", async () => {
    const denied = await listServicesForAdmin(
      listClient({ data: null, error: { code: "42501", message: "permission denied for view services_admin" } })
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.kind).toBe("unauthorized");

    const empty = await listServicesForAdmin(listClient({ data: [], error: null }));
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.data).toEqual([]);
  });

  it("listCategoriesForAdmin: denial -> unauthorized; rows pass through", async () => {
    const denied = await listCategoriesForAdmin(
      listClient({ data: null, error: { code: "42501", message: "permission denied for view categories_admin" } })
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.kind).toBe("unauthorized");

    const row = { id: "10000000-0000-0000-0000-000000000001", name: "Tyres", description: null };
    const ok = await listCategoriesForAdmin(listClient({ data: [row], error: null }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data).toEqual([row]);
  });

  it("getBranchForAdmin: 42501 denial -> unauthorized, NOT the old null", async () => {
    const res = await getBranchForAdmin(
      branchClient({ data: null, error: { code: "42501", message: "permission denied for view branches_admin" } })
    );
    expect(res).toEqual({
      ok: false,
      kind: "unauthorized",
      message: "permission denied for view branches_admin",
    });
  });

  it("getBranchForAdmin: zero visible rows -> ok + null (valid request, empty)", async () => {
    const res = await getBranchForAdmin(branchClient({ data: null, error: null }));
    expect(res).toEqual({ ok: true, data: null });
  });

  it("getBranchForAdmin: admin row returns typed branch data", async () => {
    const row = { id: "10000000-0000-0000-0000-000000000001", name: "WELL LUPS" };
    const res = await getBranchForAdmin(branchClient({ data: row, error: null }));
    expect(res).toEqual({ ok: true, data: row });
  });

  it("listStaffForAdmin: 42501 RPC denial -> unauthorized, not []", async () => {
    const res = await listStaffForAdmin(
      rpcClient({ data: null, error: { code: "42501", message: "forbidden: admin only" } })
    );
    expect(res).toEqual({ ok: false, kind: "unauthorized", message: "forbidden: admin only" });
  });

  it("listStaffForAdmin: admin roster -> ok + array (possibly empty)", async () => {
    const res = await listStaffForAdmin(rpcClient({ data: [], error: null }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });
});

// ─── 3. Source audit ──────────────────────────────────────────────────

const REPAIRED_PAGES = [
  "app/admin/products/page.tsx",
  "app/admin/services/page.tsx",
  "app/admin/staff/page.tsx",
  "app/admin/settings/page.tsx",
];

describe("GATE 023 unit — source audit: repaired pages use the authenticated path", () => {
  for (const page of REPAIRED_PAGES) {
    it(`${page}: no anon admin reads, shared token gate, admin role gate`, () => {
      const src = readSrc(page);
      // The S1 root cause itself: these pages must never read admin
      // projections through the public/anon client again.
      expect(src).not.toMatch(/publicSupabase/);
      // The duplicated local gate is gone; the shared helper is imported.
      expect(src).not.toMatch(/async function scopedClientOrError/);
      expect(src).toMatch(/scopedClientOrError/);
      expect(src).toMatch(/from "@\/lib\/supabase\/scoped-client"/);
      // Reads are token-scoped server actions, admin-role gated.
      expect(src).toMatch(/"use server"/);
      expect(src).toMatch(/gate\.role !== "admin"/);
      expect(src).toMatch(/kind: "unauthorized"/);
      // Defense-in-depth pin: no service-role credential anywhere.
      expect(src).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE/i);
    });
  }

  it("settings page renders the loader panel instead of a server-side fetch", () => {
    const src = readSrc("app/admin/settings/page.tsx");
    expect(src).toMatch(/BranchSettingsPanel/);
    expect(src).not.toMatch(/getBranchForAdmin\(publicSupabase\)/);
    // The save path stays the full-replacement RPC via updateBranchSettings.
    const panel = readSrc("components/admin/branch-settings-panel.tsx");
    // GATE 026: states render through the shared ErrorState/EmptyState/
    // LoadingState (testId prop) instead of hand-rolled divs — the three
    // outcomes stay visually distinct with the same honest copy.
    expect(panel).toMatch(/LoadingState/);
    expect(panel).toMatch(/ErrorState/);
    expect(panel).toMatch(/EmptyState/);
    expect(panel).toMatch(/testId="settings-unauthorized"/);
    expect(panel).toMatch(/testId="settings-error"/);
    expect(panel).toMatch(/testId="settings-missing"/);
    expect(panel).toMatch(/Could not read branch settings — access denied/);
    expect(panel).toMatch(/Branch Configuration Not Found/);
  });

  it("catalog/staff/branch helpers no longer swallow failures into [] / null", () => {
    const catalogAdmin = readSrc("lib/supabase/catalog-admin.ts");
    expect(catalogAdmin).toMatch(/return readFailure\(error\)/);
    expect(catalogAdmin).not.toMatch(/return \[\];/);

    const staffAdmin = readSrc("lib/supabase/staff-admin.ts");
    expect(staffAdmin).toMatch(/return readFailure\(error\)/);
    expect(staffAdmin).not.toMatch(/return \[\];/);

    const branch = readSrc("lib/supabase/branch.ts");
    expect(branch).toMatch(/Promise<ProtectedReadResult<BranchData \| null>>/);
    expect(branch).toMatch(/maybeSingle\(\)/);

    const scoped = readSrc("lib/supabase/scoped-client.ts");
    expect(scoped).toMatch(/export function classifyReadError/);
    expect(scoped).toMatch(/export async function scopedClientOrError/);
  });

  it("panels distinguish access-denied and unexpected-error from honest empty", () => {
    // GATE 026: the three outcomes render through the shared
    // ErrorState/EmptyState/LoadingState (testId prop) with the same
    // honest copy — distinct states, no hand-rolled duplicates.
    const products = readSrc("components/admin/products-admin-panel.tsx");
    expect(products).toMatch(/testId="products-unauthorized"/);
    expect(products).toMatch(/Could not read products — access denied/);
    expect(products).toMatch(/Could not read products — unexpected database error/);
    expect(products).toMatch(/data-testid="products-empty"/);
    expect(products).toMatch(/No products configured yet/);

    const services = readSrc("components/admin/services-admin-panel.tsx");
    expect(services).toMatch(/testId="services-unauthorized"/);
    expect(services).toMatch(/Could not read services — access denied/);
    expect(services).toMatch(/Could not read services — unexpected database error/);
    expect(services).toMatch(/data-testid="services-empty"/);
    expect(services).toMatch(/No services configured yet/);

    const staff = readSrc("components/admin/staff-admin-panel.tsx");
    expect(staff).toMatch(/testId="staff-unauthorized"/);
    expect(staff).toMatch(/Could not read staff roster — access denied/);
    expect(staff).toMatch(/Could not read staff roster — unexpected database error/);
    expect(staff).toMatch(/data-testid="staff-empty"/);
  });

  it("migrations 015 / 016 / 017 are untouched by this gate's diff (read-only pins)", () => {
    // These assertions pin the security model the repair must preserve:
    // admin predicates on the protected views, anon revokes, and the
    // fail-closed staff RPC. If any of these strings disappear the repair
    // has weakened the database boundary.
    const m015 = readSrc("supabase/migrations/015_v0.4.1_mpesa_settings_and_admin_catalog_writes.sql");
    expect(m015).toMatch(/where \(select app\.request_role\(\)\) = 'admin'/);
    expect(m015).toMatch(/grant select on public\.services_admin to authenticated/);

    const m016 = readSrc("supabase/migrations/016_v0.4.1_security_and_admin_write_path_hardening.sql");
    expect(m016).toMatch(/revoke all on public\.products_admin from anon, public/);
    expect(m016).toMatch(/revoke all on public\.branches_admin from anon, public/);
    expect(m016).toMatch(/revoke all on public\.categories_admin from anon, public/);
    expect(m016).toMatch(/where \(select app\.request_role\(\)\) = 'admin'/);

    const m017 = readSrc("supabase/migrations/017_staff_admin_self_service.sql");
    expect(m017).toMatch(/raise exception 'forbidden: admin only' using errcode = '42501'/);
    expect(m017).toMatch(/revoke execute on function public\.admin_list_staff\(\) from public, anon/);
  });
});
