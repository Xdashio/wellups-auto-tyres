"use client";

import { CsvImporter } from "@/components/admin/csv-importer";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
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
    return <LoadingState text="Loading categories…" testId="import-categories-loading" />;
  }

  if (read.status === "unauthorized") {
    return (
      <ErrorState
        title="Could not read categories — access denied."
        message={read.message}
        testId="import-categories-unauthorized"
      />
    );
  }

  if (read.status === "error") {
    return (
      <ErrorState
        title="Could not read categories."
        message={read.message}
        testId="import-categories-error"
      />
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
