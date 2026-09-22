import React from "react";
import {
  listStaffForAdmin,
  inviteStaff,
  revokeStaffInvite,
  setStaffRole,
  removeStaff,
  type StaffRole,
} from "@/lib/supabase/staff-admin";
import {
  clientWithAccessToken,
  verifiedStaffActor,
} from "@/lib/supabase/scoped-client";
import { StaffAdminPanel } from "@/components/admin/staff-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

// Same token-scoped pattern as the other admin pages: the browser passes
// its session access token, the action validates it, and the 017 RPCs
// enforce the Admin role from the JWT server-side (fail-closed 42501).
// RLS remains authoritative; no service-role key is involved anywhere.
async function scopedClientOrError(accessToken: string) {
  const scoped = clientWithAccessToken(accessToken);
  if (!scoped) return { error: "Not authenticated. Sign in as a staff member first." };
  const actor = await verifiedStaffActor(scoped);
  if ("error" in actor) return { error: actor.error };
  return { scoped };
}

export default async function AdminStaffPage() {
  const { publicSupabase } = await import("@/lib/supabase/catalog");
  // The roster RPC itself is admin-gated: non-admin callers get an empty
  // list here (the error is swallowed by design — the gate below explains
  // sign-in, and every mutation re-checks server-side).
  const roster = await listStaffForAdmin(publicSupabase);

  async function handleInvite(accessToken: string, email: string, role: StaffRole, displayName?: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error ?? "Not authenticated." };
    return inviteStaff(gate.scoped, { email, role, displayName });
  }

  async function handleRevokeInvite(accessToken: string, inviteId: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error ?? "Not authenticated." };
    return revokeStaffInvite(gate.scoped, inviteId);
  }

  async function handleSetRole(accessToken: string, staffId: string, role: StaffRole) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error ?? "Not authenticated." };
    return setStaffRole(gate.scoped, staffId, role);
  }

  async function handleRemove(accessToken: string, staffId: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error ?? "Not authenticated." };
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
        initialRoster={roster}
        onInvite={handleInvite}
        onRevokeInvite={handleRevokeInvite}
        onSetRole={handleSetRole}
        onRemove={handleRemove}
      />
    </div>
  );
}
