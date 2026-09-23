"use client";

import React from "react";
import type { BranchData, BranchSettingsInput } from "@/lib/supabase/branch";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { BranchSettingsForm } from "@/components/admin/branch-settings-form";

// Load-state wrapper around the branch settings form (GATE 023, defect
// S1). The form itself is unchanged; this component owns the four read
// outcomes so the page can never again present an authorization failure as
// "Branch Configuration Not Found":
//   unauthorized -> access denied (anon, or a signed-in non-Admin role)
//   error        -> unexpected database failure, surfaced verbatim
//   ready+null   -> Admin authenticated, branches_admin returned zero rows
//   ready+row    -> the real configuration form
interface BranchSettingsPanelProps {
  onLoad: (accessToken: string) => Promise<ProtectedReadResult<BranchData | null>>;
  onSave: (
    accessToken: string,
    branchId: string,
    input: BranchSettingsInput
  ) => Promise<{ success: boolean; error?: string; data?: BranchData }>;
}

export function BranchSettingsPanel({ onLoad, onSave }: BranchSettingsPanelProps) {
  const read = useProtectedRead(onLoad);

  if (read.status === "loading") {
    return (
      <div data-testid="settings-loading" className="text-center py-16">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-2">Loading branch settings...</p>
      </div>
    );
  }

  if (read.status === "unauthorized") {
    return (
      <div
        data-testid="settings-unauthorized"
        className="max-w-2xl mx-auto text-center py-12 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2"
      >
        <p className="text-lg font-semibold text-destructive">
          Could not read branch settings — access denied.
        </p>
        <p className="text-sm text-text-secondary">{read.message}</p>
      </div>
    );
  }

  if (read.status === "error") {
    return (
      <div
        data-testid="settings-error"
        className="max-w-2xl mx-auto text-center py-12 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2"
      >
        <p className="text-lg font-semibold text-destructive">
          Could not read branch settings — unexpected database error.
        </p>
        <p className="text-sm text-text-secondary">{read.message}</p>
      </div>
    );
  }

  if (read.data === null) {
    // Only reachable by a signed-in Admin whose read of branches_admin
    // genuinely returned zero rows — an honest empty state, not a denial.
    return (
      <div
        data-testid="settings-missing"
        className="max-w-2xl mx-auto text-center py-12 border rounded-lg bg-blue-muted/10 space-y-2"
      >
        <p className="text-lg font-semibold text-destructive">Branch Configuration Not Found</p>
        <p className="text-sm text-text-secondary">
          Your Admin account read branches_admin successfully, but it returned zero rows —
          no branch has been configured yet.
        </p>
      </div>
    );
  }

  const branch = read.data;
  return (
    <BranchSettingsForm
      initialBranch={branch}
      onSave={(accessToken, input) => onSave(accessToken, branch.id, input)}
    />
  );
}
