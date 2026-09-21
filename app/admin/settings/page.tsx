import React from "react";
import { getPrimaryBranch } from "@/lib/supabase/catalog";
import { updateBranchSettings, BranchSettingsInput } from "@/lib/supabase/branch";
import { BranchSettingsForm } from "@/components/admin/branch-settings-form";

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const branch = await getPrimaryBranch();

  if (!branch) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-rose-600">Branch Configuration Not Found</h1>
        <p className="text-sm text-text-secondary mt-2">
          Unable to load primary branch configuration.
        </p>
      </div>
    );
  }

  const branchId = branch.id;

  // Typed save handler passed to Client Form component
  async function handleSaveSettings(input: BranchSettingsInput) {
    "use server";
    // In Server Action context, we invoke publicSupabase / server client
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return updateBranchSettings(publicSupabase, branchId, input);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure business details and public contact settings for Well Lups Auto Tyres.
        </p>
      </div>

      <BranchSettingsForm initialBranch={branch} onSave={handleSaveSettings} />
    </div>
  );
}
