import React from "react";
import { getPrimaryBranch } from "@/lib/supabase/catalog";
import { listCategoriesForAdmin, type ProductInput } from "@/lib/supabase/catalog-admin";
import { upsertProductsBySku, type BulkUpsertResult } from "@/lib/supabase/catalog-import";
import { scopedClientOrError, type ProtectedReadResult } from "@/lib/supabase/scoped-client";
import type { AdminCategory } from "@/lib/supabase/catalog-admin";
import { ImportCategoriesLoader } from "@/components/admin/import-categories-loader";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 0;

// GATE 025: the category dropdown is an admin-only read (categories_admin
// is revoked from anon by 016), so it goes through the same token-scoped
// protected-read architecture as the other S1 surfaces. The browser passes
// its session token; the action enforces the admin role; unauthorized /
// error / honest-empty stay distinct instead of collapsing into "none yet".
const ADMIN_ONLY_READ = "Catalogue management is Admin-only. Sign in with an Admin account.";

export default async function AdminProductImportPage() {
  const branch = await getPrimaryBranch();

  async function handleLoadCategories(
    accessToken: string
  ): Promise<ProtectedReadResult<AdminCategory[]>> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { ok: false, kind: "unauthorized", message: gate.error };
    if (gate.role !== "admin") return { ok: false, kind: "unauthorized", message: ADMIN_ONLY_READ };
    return listCategoriesForAdmin(gate.scoped);
  }

  async function handleImport(accessToken: string, rows: ProductInput[]): Promise<BulkUpsertResult> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { created: 0, updated: 0, failed: [{ key: "(auth)", error: gate.error ?? "Not authenticated. Sign in as a staff member first." }] };
    return upsertProductsBySku(gate.scoped, rows);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Import Products (CSV)"
        description="Bulk upsert by SKU: new SKUs are created, existing SKUs are updated in place — re-running the same file changes nothing. Every row is validated before anything is written, and nothing is written until you confirm."
      />

      <StaffAuthGate context="Sign in as an Admin to bulk-import products. Catalog writes are admin-only." />

      <ImportCategoriesLoader
        branchId={branch?.id || ""}
        templateHref="/import-templates/products.csv"
        onLoadCategories={handleLoadCategories}
        onImport={handleImport}
      />
    </div>
  );
}
