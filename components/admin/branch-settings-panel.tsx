"use client";

import React from "react";
import type { BranchData, BranchSettingsInput } from "@/lib/supabase/branch";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { BranchSettingsForm } from "@/components/admin/branch-settings-form";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";

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
    return <LoadingState text="Loading branch settings..." testId="settings-loading" />;
  }

  if (read.status === "unauthorized") {
    return (
      <div className="max-w-2xl mx-auto">
        <ErrorState
          title="Could not read branch settings — access denied."
          message={read.message}
          testId="settings-unauthorized"
        />
      </div>
    );
  }

  if (read.status === "error") {
    return (
      <div className="max-w-2xl mx-auto">
        <ErrorState
          title="Could not read branch settings — unexpected database error."
          message={read.message}
          testId="settings-error"
        />
      </div>
    );
  }

  if (read.data === null) {
    // Only reachable by a signed-in Admin whose read of branches_admin
    // genuinely returned zero rows — an honest empty state, not a denial.
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState
          heading="Branch Configuration Not Found"
          body="Your Admin account read branches_admin successfully, but it returned zero rows — no branch has been configured yet."
          testId="settings-missing"
        />
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
