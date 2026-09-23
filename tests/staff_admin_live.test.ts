import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Live boundary tests for the 017 staff-admin surface. Equivalent of the
// admin_write_paths suite for this new surface: anon and non-admin actors
// must be denied, admin reads must work, and an invite/revoke round-trip
// must leave zero residue. Destructive paths (role change on real staff,
// deactivation) are covered by supabase/tests/017_staff_admin.test.sql on
// scratch — this suite never mutates a real staff mapping.
//
// PRECONDITION: migration 017 must be pushed to the live project first.
// The first test asserts that loudly and fail-closed; everything else
// depends on it. Run: npx vitest run tests/staff_admin_live.test.ts
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

async function signIn(email: string): Promise<SupabaseClient | null> {
  const client = createClient(supabaseUrl, supabaseAnonKey!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "TestPassword123!",
  });
  if (error) {
    console.log(`live: sign-in as ${email} unavailable (${error.message})`);
    return null;
  }
  return client;
}

describe("staff_admin live — 017 deployment precondition", () => {
  beforeAll(() => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey!);
  });

  it("017 RPCs exist on the live project (push 017 first)", async () => {
    const { error } = await anonClient.rpc("admin_list_staff");
    // PGRST202 = function missing. Anything else (including the expected
    // 42501 denial) proves the RPC is deployed.
    expect(error?.code ?? "deployed").not.toBe("PGRST202");
  });
});

describe("staff_admin live — boundary matrix (requires 017 pushed)", () => {
  beforeAll(() => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey!);
  });

  it("anon is denied on every staff RPC", async () => {
    for (const call of [
      anonClient.rpc("admin_list_staff"),
      anonClient.rpc("admin_invite_staff", { p_email: "probe@test.local", p_role: "cashier" }),
      anonClient.rpc("admin_revoke_invite", { p_invite_id: "00000000-0000-0000-0000-000000000000" }),
      anonClient.rpc("admin_set_staff_role", {
        p_staff_id: "00000000-0000-0000-0000-000000000000",
        p_role: "cashier",
      }),
      anonClient.rpc("admin_remove_staff", { p_staff_id: "00000000-0000-0000-0000-000000000000" }),
    ]) {
      const { error } = await call;
      expect(error).not.toBeNull();
    }
  });

  it("manager and cashier are denied on every staff RPC", async () => {
    for (const email of ["mgr@test.local", "cashier@test.local"]) {
      const client = await signIn(email);
      if (!client) continue;
      for (const call of [
        client.rpc("admin_list_staff"),
        client.rpc("admin_invite_staff", { p_email: "probe@test.local", p_role: "cashier" }),
        client.rpc("admin_set_staff_role", {
          p_staff_id: "00000000-0000-0000-0000-000000000000",
          p_role: "cashier",
        }),
        client.rpc("admin_remove_staff", { p_staff_id: "00000000-0000-0000-0000-000000000000" }),
      ]) {
        const { error } = await call;
        expect(error).not.toBeNull();
      }
    }
  });

  it("admin roster lists without leaking the auth user table", async () => {
    const admin = await signIn("admin@test.local");
    expect(admin, "admin@test.local must exist").not.toBeNull();
    if (!admin) return;
    const { data, error } = await admin.rpc("admin_list_staff");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const row of data as Record<string, unknown>[]) {
      // Roster projection only: no password hashes, no identities payload.
      expect(row).not.toHaveProperty("encrypted_password");
      expect(row.status === "active" || row.status === "invited").toBe(true);
    }
  });

  it("admin invite/revoke round-trip leaves zero residue", async () => {
    const admin = await signIn("admin@test.local");
    expect(admin, "admin@test.local must exist").not.toBeNull();
    if (!admin) return;
    const probe = `staffprobe-${Date.now()}@test.local`;
    const invited = await admin.rpc("admin_invite_staff", { p_email: probe, p_role: "cashier" });
    expect(invited.error).toBeNull();

    const { data: roster } = await admin.rpc("admin_list_staff");
    const row = (roster as { email: string; status: string; invite_id: string }[]).find(
      (r) => r.email === probe
    );
    expect(row?.status).toBe("invited");

    const revoked = await admin.rpc("admin_revoke_invite", { p_invite_id: row!.invite_id });
    expect(revoked.error).toBeNull();

    const { data: after } = await admin.rpc("admin_list_staff");
    expect((after as { email: string }[]).some((r) => r.email === probe)).toBe(false);
  });

  it("admin set-role/remove on unknown ids fail closed", async () => {
    const admin = await signIn("admin@test.local");
    expect(admin, "admin@test.local must exist").not.toBeNull();
    if (!admin) return;
    const missing = "00000000-0000-0000-0000-000000000000";
    const changed = await admin.rpc("admin_set_staff_role", { p_staff_id: missing, p_role: "cashier" });
    expect(changed.error).not.toBeNull();
    const removed = await admin.rpc("admin_remove_staff", { p_staff_id: missing });
    expect(removed.error).not.toBeNull();
  });
});
