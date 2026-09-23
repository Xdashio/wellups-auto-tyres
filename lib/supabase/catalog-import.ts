// Server-side bulk upsert for the admin CSV importer.
// Upsert keys mirror supabase/production/catalog.template.sql: natural key
// (sku for products; name for services — idempotent, re-runs update in
// place, never duplicate). Writes go through the existing create/update
// helpers in lib/supabase/catalog-admin.ts, so every row is re-validated by
// the same Zod schemas AND enforced by RLS on the admin views. No new SQL,
// no migrations, no direct table access. The reserved-name guard is
// re-checked here so a crafted client payload can never bypass it.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ProductInputSchema,
  ServiceInputSchema,
  createProduct,
  updateProduct,
  createService,
  updateService,
  type ProductInput,
  type ServiceInput,
} from "./catalog-admin";
import { RESERVED_NAME_PREFIXES } from "@/lib/catalog/csv-import";

export interface BulkUpsertResult {
  created: number;
  updated: number;
  failed: { key: string; error: string }[];
}

function reservedNameError(name: string): string | null {
  for (const prefix of RESERVED_NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      return `Refused: name starts with reserved prefix "${prefix}"`;
    }
  }
  return null;
}

export async function upsertProductsBySku(
  client: SupabaseClient,
  rows: ProductInput[]
): Promise<BulkUpsertResult> {
  const result: BulkUpsertResult = { created: 0, updated: 0, failed: [] };
  // Key existing rows by SKU once — catalog-scale lookup, one query.
  const { data: existing, error: listError } = await client
    .from("products_admin")
    .select("id, sku");
  if (listError || !existing) {
    for (const r of rows) {
      result.failed.push({ key: r.sku || "(missing sku)", error: listError?.message ?? "Could not list existing products" });
    }
    return result;
  }
  const bySku = new Map<string, string>();
  for (const row of existing as { id: string; sku: string }[]) {
    if (!bySku.has(row.sku)) bySku.set(row.sku, row.id);
  }
  for (const input of rows) {
    const validation = ProductInputSchema.safeParse(input);
    if (!validation.success) {
      result.failed.push({
        key: (input as { sku?: string }).sku || "(missing sku)",
        error: validation.error.issues.map((i) => i.message).join(", "),
      });
      continue;
    }
    const clean = validation.data;
    const refused = reservedNameError(clean.name);
    if (refused) {
      result.failed.push({ key: clean.sku, error: refused });
      continue;
    }
    const id = bySku.get(clean.sku);
    const res = id
      ? await updateProduct(client, id, clean)
      : await createProduct(client, clean);
    if (!res.success) {
      result.failed.push({ key: clean.sku, error: res.error || "Write failed" });
    } else if (id) {
      result.updated += 1;
    } else {
      result.created += 1;
      // A later row in the same file reusing this SKU updates the new row.
      // (Client-side validation already rejects in-file duplicates; this is
      // belt-and-braces for direct callers.)
      const { data: created } = await client
        .from("products_admin")
        .select("id")
        .eq("sku", clean.sku)
        .limit(1)
        .single();
      const newId = (created as { id: string } | null)?.id;
      if (newId) bySku.set(clean.sku, newId);
    }
  }
  return result;
}

export async function upsertServicesByName(
  client: SupabaseClient,
  rows: ServiceInput[]
): Promise<BulkUpsertResult> {
  const result: BulkUpsertResult = { created: 0, updated: 0, failed: [] };
  // services.name has no UNIQUE constraint (see catalog.template.sql), so
  // the upsert is an explicit match-then-update-or-insert — same pattern.
  const { data: existing, error: listError } = await client
    .from("services_admin")
    .select("id, name");
  if (listError || !existing) {
    for (const r of rows) {
      result.failed.push({ key: r.name || "(missing name)", error: listError?.message ?? "Could not list existing services" });
    }
    return result;
  }
  const byName = new Map<string, string>();
  for (const row of existing as { id: string; name: string }[]) {
    if (!byName.has(row.name)) byName.set(row.name, row.id);
  }
  for (const input of rows) {
    const validation = ServiceInputSchema.safeParse(input);
    if (!validation.success) {
      result.failed.push({
        key: (input as { name?: string }).name || "(missing name)",
        error: validation.error.issues.map((i) => i.message).join(", "),
      });
      continue;
    }
    const clean = validation.data;
    const refused = reservedNameError(clean.name);
    if (refused) {
      result.failed.push({ key: clean.name, error: refused });
      continue;
    }
    const id = byName.get(clean.name);
    const res = id
      ? await updateService(client, id, clean)
      : await createService(client, clean);
    if (!res.success) {
      result.failed.push({ key: clean.name, error: res.error || "Write failed" });
    } else if (id) {
      result.updated += 1;
    } else {
      result.created += 1;
      const { data: created } = await client
        .from("services_admin")
        .select("id")
        .eq("name", clean.name)
        .limit(1)
        .single();
      const newId = (created as { id: string } | null)?.id;
      if (newId) byName.set(clean.name, newId);
    }
  }
  return result;
}
