"use client";

import { CsvImporter } from "@/components/admin/csv-importer";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import type {
  AdminCategory,
  ProductInput,
} from "@/lib/supabase/catalog-admin";
import type { BulkUpsertResult } from "@/lib/supabase/catalog-import";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";

// Token-scoped category read for /admin/products/import (GATE 025).
// The category dropdown used to read categories_admin through the anon
// client, which the 016 revocation denies — every operator saw "none yet"
// in the template hint whether or not categories existed. The read now
// goes through the same authenticated protected-read architecture as the
// other S1 surfaces: the browser passes its session token, the server
// action enforces the admin role, and the three outcomes stay visually
// distinct (unauthorized / unexpected error / honest empty).
export function ImportCategoriesLoader({
  branchId,
  templateHref,
  onLoadCategories,
  onImport,
}: {
  branchId: string;
  templateHref: string;
  onLoadCategories: (accessToken: string) => Promise<ProtectedReadResult<AdminCategory[]>>;
  onImport: (accessToken: string, rows: ProductInput[]) => Promise<BulkUpsertResult>;
}) {
  const read = useProtectedRead(onLoadCategories);

  if (read.status === "loading") {
    return (
      <div className="p-8 text-center" data-testid="import-categories-loading">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-3">Loading categories…</p>
      </div>
    );
  }

  if (read.status === "unauthorized") {
    return (
      <div
        className="p-4 bg-blue-muted/10 border border-blue-muted/30 rounded-lg"
        data-testid="import-categories-unauthorized"
      >
        <p className="text-sm font-semibold">Could not read categories — access denied.</p>
        <p className="text-xs text-text-secondary mt-1">{read.message}</p>
      </div>
    );
  }

  if (read.status === "error") {
    return (
      <div
        className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
        data-testid="import-categories-error"
      >
        <p className="text-sm font-semibold text-destructive">Could not read categories.</p>
        <p className="text-xs text-text-secondary mt-1">{read.message}</p>
      </div>
    );
  }

  return (
    <CsvImporter
      kind="products"
      branchId={branchId}
      categories={read.data}
      templateHref={templateHref}
      onImport={onImport}
    />
  );
}
