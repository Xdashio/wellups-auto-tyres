import React from "react";
import { getPrimaryBranch, publicSupabase } from "@/lib/supabase/catalog";
import { listCategoriesForAdmin, type ProductInput } from "@/lib/supabase/catalog-admin";
import { upsertProductsBySku, type BulkUpsertResult } from "@/lib/supabase/catalog-import";
import {
  clientWithAccessToken,
  verifiedStaffActor,
} from "@/lib/supabase/scoped-client";
import { CsvImporter } from "@/components/admin/csv-importer";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

async function scopedClientOrError(accessToken: string) {
  const scoped = clientWithAccessToken(accessToken);
  if (!scoped) return { error: "Not authenticated. Sign in as a staff member first." };
  const actor = await verifiedStaffActor(scoped);
  if ("error" in actor) return { error: actor.error };
  return { scoped };
}

export default async function AdminProductImportPage() {
  const branch = await getPrimaryBranch();
  const categories = await listCategoriesForAdmin(publicSupabase);

  async function handleImport(accessToken: string, rows: ProductInput[]): Promise<BulkUpsertResult> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { created: 0, updated: 0, failed: [{ key: "(auth)", error: gate.error ?? "Not authenticated. Sign in as a staff member first." }] };
    return upsertProductsBySku(gate.scoped, rows);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Import Products (CSV)</h1>
        <p className="text-sm text-text-secondary mt-1">
          Bulk upsert by SKU: new SKUs are created, existing SKUs are updated in
          place — re-running the same file changes nothing. Every row is
          validated before anything is written, and nothing is written until
          you confirm.
        </p>
      </div>

      <StaffAuthGate context="Sign in as an Admin to bulk-import products. Catalog writes are admin-only." />

      <CsvImporter
        kind="products"
        branchId={branch?.id || ""}
        categories={categories}
        templateHref="/import-templates/products.csv"
        onImport={handleImport}
      />
    </div>
  );
}
