import React from "react";
import {
  getBranchForAdmin,
  updateBranchSettings,
  BranchSettingsInput,
  BranchData,
} from "@/lib/supabase/branch";
import {
  scopedClientOrError,
  type ProtectedReadResult,
} from "@/lib/supabase/scoped-client";
import { BranchSettingsPanel } from "@/components/admin/branch-settings-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 0;

// GATE 023 (defect S1): this page used to read branches_admin during
// server render with the ANON client. Post-016 anon is revoked on the
// view, so the read always failed, the failure was swallowed into null,
// and every visitor — including a signed-in Admin — saw a false "Branch
// Configuration Not Found". The read below is a token-scoped server
// action returning a typed result. branches_admin's predicate is
// request_role() = 'admin' (016), so:
//   Admin        -> real branch row (or ok+null if zero rows exist)
//   Manager      -> explicit unauthorized result (established policy:
//   Cashier        they remain denied; the view predicate would also
//                  filter them to zero rows)
//   Anon         -> no token is ever sent; the panel renders the
//                   access-denied state
// The save path is unchanged: admin_update_branch_settings remains the
// full-replacement write RPC, re-validated from the caller's JWT.
const SETTINGS_ONLY_ADMIN = "Branch settings are Admin-only. Sign in with an Admin account.";

export default async function AdminSettingsPage() {
  async function handleLoadBranch(
    accessToken: string
  ): Promise<ProtectedReadResult<BranchData | null>> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { ok: false, kind: "unauthorized", message: gate.error };
    if (gate.role !== "admin") return { ok: false, kind: "unauthorized", message: SETTINGS_ONLY_ADMIN };
    return getBranchForAdmin(gate.scoped);
  }

  // Typed save handler passed to the Client Form component. Runs as the
  // signed-in staff member (token validated server-side); the branch RPC
  // enforces the admin role from the caller's JWT. branchId comes from the
  // caller's own authenticated read of branches_admin — never from a
  // client-authored value.
  async function handleSaveSettings(
    accessToken: string,
    branchId: string,
    input: BranchSettingsInput
  ) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return updateBranchSettings(gate.scoped, branchId, input);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Admin Settings"
        description="Configure business details and public contact settings for Well Lups Auto Tyres."
      />

      <StaffAuthGate context="Sign in as an Admin to change branch and M-Pesa settings. Settings writes are admin-only." />

      <BranchSettingsPanel onLoad={handleLoadBranch} onSave={handleSaveSettings} />
    </div>
  );
}
