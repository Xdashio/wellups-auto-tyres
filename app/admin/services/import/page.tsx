import React from "react";
import { type ServiceInput } from "@/lib/supabase/catalog-admin";
import { upsertServicesByName, type BulkUpsertResult } from "@/lib/supabase/catalog-import";
import { scopedClientOrError } from "@/lib/supabase/scoped-client";
import { CsvImporter } from "@/components/admin/csv-importer";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

export default async function AdminServiceImportPage() {
  async function handleImport(accessToken: string, rows: ServiceInput[]): Promise<BulkUpsertResult> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { created: 0, updated: 0, failed: [{ key: "(auth)", error: gate.error ?? "Not authenticated. Sign in as a staff member first." }] };
    return upsertServicesByName(gate.scoped, rows);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Import Services (CSV)</h1>
        <p className="text-sm text-text-secondary mt-1">
          Bulk upsert by name: new names are created, existing names are
          updated in place — re-running the same file changes nothing. Every
          row is validated before anything is written, and nothing is written
          until you confirm.
        </p>
      </div>

      <StaffAuthGate context="Sign in as an Admin to bulk-import services. Catalog writes are admin-only." />

      <CsvImporter
        kind="services"
        branchId=""
        categories={[]}
        templateHref="/import-templates/services.csv"
        onImport={handleImport}
      />
    </div>
  );
}
