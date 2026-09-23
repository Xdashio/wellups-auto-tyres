import React from "react";
import {
  listStaffForAdmin,
  inviteStaff,
  revokeStaffInvite,
  setStaffRole,
  removeStaff,
  type StaffRole,
  type StaffRosterEntry,
} from "@/lib/supabase/staff-admin";
import {
  scopedClientOrError,
  type ProtectedReadResult,
} from "@/lib/supabase/scoped-client";
import { StaffAdminPanel } from "@/components/admin/staff-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

// Same token-scoped pattern as the other admin pages: the browser passes
// its session access token, the action validates it, and the 017 RPCs
// enforce the Admin role from the JWT server-side (fail-closed 42501).
// RLS remains authoritative; no service-role key is involved anywhere.
//
// GATE 023 (defect S1): the roster used to be read during server render
// with the ANON client, so admin_list_staff failed (execute revoked from
// anon by 017) and the error was swallowed into [] — the page told every
// operator "No staff yet". The read below is a token-scoped action with a
// typed result: Admin gets the real roster (or an honest empty list),
// Manager/Cashier and Anon get an explicit unauthorized result while every
// mutation continues to be re-checked by the RPCs themselves.
const ADMIN_ONLY_READ = "Staff administration is Admin-only. Sign in with an Admin account.";

export default async function AdminStaffPage() {
  async function handleLoadStaff(
    accessToken: string
  ): Promise<ProtectedReadResult<StaffRosterEntry[]>> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { ok: false, kind: "unauthorized", message: gate.error };
    if (gate.role !== "admin") return { ok: false, kind: "unauthorized", message: ADMIN_ONLY_READ };
    return listStaffForAdmin(gate.scoped);
  }

  async function handleInvite(accessToken: string, email: string, role: StaffRole, displayName?: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return inviteStaff(gate.scoped, { email, role, displayName });
  }

  async function handleRevokeInvite(accessToken: string, inviteId: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return revokeStaffInvite(gate.scoped, inviteId);
  }

  async function handleSetRole(accessToken: string, staffId: string, role: StaffRole) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return setStaffRole(gate.scoped, staffId, role);
  }

  async function handleRemove(accessToken: string, staffId: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return removeStaff(gate.scoped, staffId);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Staff Access</h1>
        <p className="text-sm text-text-secondary mt-1">
          Admin-only. Grant roles, change roles, or deactivate staff. Every
          action is enforced server-side — including the rails that protect
          the last admin and your own record.
        </p>
      </div>

      <StaffAuthGate context="Sign in as an Admin to manage staff access. This page is admin-only." />

      <StaffAdminPanel
        onLoad={handleLoadStaff}
        onInvite={handleInvite}
        onRevokeInvite={handleRevokeInvite}
        onSetRole={handleSetRole}
        onRemove={handleRemove}
      />
    </div>
  );
}
