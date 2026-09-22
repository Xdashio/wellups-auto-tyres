import React from "react";
import { getBranchForAdmin, updateBranchSettings, BranchSettingsInput } from "@/lib/supabase/branch";
import { publicSupabase } from "@/lib/supabase/catalog";
import {
  clientWithAccessToken,
  verifiedStaffActor,
} from "@/lib/supabase/scoped-client";
import { BranchSettingsForm } from "@/components/admin/branch-settings-form";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const branch = await getBranchForAdmin(publicSupabase);

  if (!branch) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-destructive">Branch Configuration Not Found</h1>
        <p className="text-sm text-text-secondary mt-2">
          Unable to load primary branch configuration.
        </p>
      </div>
    );
  }

  const branchId = branch.id;

  // Typed save handler passed to Client Form component. Runs as the signed-in
  // staff member (token validated server-side); the branch RPC enforces the
  // admin role from the caller's JWT.
  async function handleSaveSettings(accessToken: string, input: BranchSettingsInput) {
    "use server";
    const scoped = clientWithAccessToken(accessToken);
    if (!scoped) {
      return { success: false, error: "Not authenticated. Sign in as a staff member first." };
    }
    const actor = await verifiedStaffActor(scoped);
    if ("error" in actor) {
      return { success: false, error: actor.error };
    }
    return updateBranchSettings(scoped, branchId, input);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure business details and public contact settings for Well Lups Auto Tyres.
        </p>
      </div>

      <StaffAuthGate context="Sign in as an Admin to change branch and M-Pesa settings. Settings writes are admin-only." />

      <BranchSettingsForm initialBranch={branch} onSave={handleSaveSettings} />
    </div>
  );
}
