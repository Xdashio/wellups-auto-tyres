// Row mapping + validation for the admin CSV bulk importer.
// Every row is validated against the SAME Zod schemas used by the
// single-row admin forms (ProductInputSchema / ServiceInputSchema in
// lib/supabase/catalog-admin.ts) — the importer cannot accept anything the
// form would reject. Pure logic (no Supabase client); the server re-runs
// these same checks before writing (see lib/supabase/catalog-import.ts).

import {
  ProductInputSchema,
  ServiceInputSchema,
  type ProductInput,
  type ServiceInput,
} from "@/lib/supabase/catalog-admin";
import type { CsvRecord } from "./csv-parse";

export const PRODUCT_CSV_HEADERS = [
  "name",
  "sku",
  "category",
  "brand",
  "size_spec",
  "cost_price",
  "sell_price",
  "stock_quantity",
  "status",
] as const;

export const SERVICE_CSV_HEADERS = [
  "name",
  "description",
  "vehicle_types",
  "is_available",
] as const;

// Names starting with these prefixes are NEVER importable. "SEED " mirrors
// the repo's seed-hygiene guard (tests/seed_hygiene.test.ts) so this
// importer can never reintroduce retired demo data; "SAMPLE " protects the
// downloadable template's example row from ever becoming a real catalog row.
export const RESERVED_NAME_PREFIXES = ["SEED ", "SAMPLE "] as const;

export interface CategoryRef {
  id: string;
  name: string;
}

export interface ValidatedRow<T> {
  lineNumber: number;
  key: string; // sku (products) or name (services) for the preview table
  status: "valid" | "invalid";
  data?: T;
  errors: string[];
  raw: Record<string, string>;
}

export interface ValidatedFile<T> {
  fileError: string | null; // header-level failure: no rows validated
  rows: ValidatedRow<T>[];
}

function toRecord(headers: string[], record: CsvRecord): Record<string, string> {
  const out: Record<string, string> = {};
  // Header matching is case-insensitive (trimmed); first occurrence wins.
  const lower = headers.map((h) => h.toLowerCase());
  for (let i = 0; i < record.values.length; i++) {
    const key = lower[i];
    if (key && !(key in out)) out[key] = record.values[i];
  }
  return out;
}

function missingHeaders(headers: string[], required: readonly string[]): string[] {
  const lower = new Set(headers.map((h) => h.toLowerCase()));
  return required.filter((h) => !lower.has(h));
}

function formatIssues(issues: { path: readonly unknown[]; message: string }[]): string[] {
  return issues.map((i) => {
    const at = i.path.length > 0 ? `${i.path.map(String).join(".")}: ` : "";
    return `${at}${i.message}`;
  });
}

function reservedNameError(name: string): string | null {
  for (const prefix of RESERVED_NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      return `name: must not start with reserved prefix "${prefix}" — demo/example rows can never be imported`;
    }
  }
  return null;
}

const opt = (v: string | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export function validateProductRows(
  headers: string[],
  records: CsvRecord[],
  opts: { branchId: string; categories: CategoryRef[] }
): ValidatedFile<ProductInput> {
  const missing = missingHeaders(headers, PRODUCT_CSV_HEADERS);
  if (missing.length > 0) {
    return {
      fileError: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${PRODUCT_CSV_HEADERS.join(", ")}`,
      rows: [],
    };
  }
  const byName = new Map(opts.categories.map((c) => [c.name.trim(), c.id]));
  const rows: ValidatedRow<ProductInput>[] = records.map((rec) => {
    const raw = toRecord(headers, rec);
    const errors: string[] = [];
    const name = (raw.name ?? "").trim();
    const sku = (raw.sku ?? "").trim();
    if (!name) errors.push("name: required");
    if (!sku) errors.push("sku: required");
    const reserved = reservedNameError(name);
    if (reserved) errors.push(reserved);
    const categoryName = (raw.category ?? "").trim();
    let category_id: string | null = null;
    if (!categoryName) {
      errors.push("category: required — must match an existing category exactly");
    } else if (!byName.has(categoryName)) {
      errors.push(
        `category: unknown "${categoryName}" — must match an existing category exactly (${opts.categories.length} available)`
      );
    } else {
      category_id = byName.get(categoryName)!;
    }
    const candidate = {
      branch_id: opts.branchId,
      category_id,
      name,
      sku,
      brand: opt(raw.brand),
      size_spec: opt(raw.size_spec),
      cost_price: (raw.cost_price ?? "").trim(),
      sell_price: (raw.sell_price ?? "").trim(),
      stock_quantity: (raw.stock_quantity ?? "").trim(),
      status: (raw.status ?? "").trim(),
    };
    const parsed = ProductInputSchema.safeParse(candidate);
    if (!parsed.success) errors.push(...formatIssues(parsed.error.issues));
    if (!parsed.success || errors.length > 0) {
      return { lineNumber: rec.lineNumber, key: sku || name || `line ${rec.lineNumber}`, status: "invalid" as const, errors, raw };
    }
    return { lineNumber: rec.lineNumber, key: parsed.data.sku, status: "valid" as const, data: parsed.data, errors: [], raw };
  });
  // Duplicate SKUs within one file are ambiguous for SKU-keyed upsert —
  // reject every row sharing a duplicated SKU rather than guessing order.
  const seen = new Map<string, ValidatedRow<ProductInput>[]>();
  for (const r of rows) {
    if (r.status !== "valid" || !r.data) continue;
    const k = r.data.sku;
    seen.set(k, [...(seen.get(k) ?? []), r]);
  }
  for (const group of seen.values()) {
    if (group.length > 1) {
      for (const r of group) {
        r.status = "invalid";
        r.errors.push(`sku: duplicate "${r.data!.sku}" appears ${group.length}x in this file — SKUs must be unique`);
        delete r.data;
      }
    }
  }
  return { fileError: null, rows };
}

const TRUTHY = new Set(["true", "1", "yes", "y"]);
const FALSY = new Set(["false", "0", "no", "n"]);

export function validateServiceRows(
  headers: string[],
  records: CsvRecord[]
): ValidatedFile<ServiceInput> {
  const missing = missingHeaders(headers, SERVICE_CSV_HEADERS);
  if (missing.length > 0) {
    return {
      fileError: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${SERVICE_CSV_HEADERS.join(", ")}`,
      rows: [],
    };
  }
  const rows: ValidatedRow<ServiceInput>[] = records.map((rec) => {
    const raw = toRecord(headers, rec);
    const errors: string[] = [];
    const name = (raw.name ?? "").trim();
    if (!name) errors.push("name: required");
    const reserved = reservedNameError(name);
    if (reserved) errors.push(reserved);
    const vehicleRaw = (raw.vehicle_types ?? "").trim();
    const vehicle_types = vehicleRaw
      ? vehicleRaw.split(";").map((v) => v.trim()).filter((v) => v !== "")
      : [];
    const availRaw = (raw.is_available ?? "").trim().toLowerCase();
    let is_available: boolean | string = true;
    if (availRaw === "") {
      is_available = true;
    } else if (TRUTHY.has(availRaw)) {
      is_available = true;
    } else if (FALSY.has(availRaw)) {
      is_available = false;
    } else {
      errors.push('is_available: must be true/false (or yes/no/1/0), empty means available');
    }
    const candidate = {
      name,
      description: opt(raw.description),
      vehicle_types,
      is_available,
    };
    const parsed = ServiceInputSchema.safeParse(candidate);
    if (!parsed.success) errors.push(...formatIssues(parsed.error.issues));
    if (!parsed.success || errors.length > 0) {
      return { lineNumber: rec.lineNumber, key: name || `line ${rec.lineNumber}`, status: "invalid" as const, errors, raw };
    }
    return { lineNumber: rec.lineNumber, key: parsed.data.name, status: "valid" as const, data: parsed.data, errors: [], raw };
  });
  // Duplicate names within one file are ambiguous for name-keyed upsert.
  const seen = new Map<string, ValidatedRow<ServiceInput>[]>();
  for (const r of rows) {
    if (r.status !== "valid" || !r.data) continue;
    const k = r.data.name;
    seen.set(k, [...(seen.get(k) ?? []), r]);
  }
  for (const group of seen.values()) {
    if (group.length > 1) {
      for (const r of group) {
        r.status = "invalid";
        r.errors.push(`name: duplicate "${r.data!.name}" appears ${group.length}x in this file — names must be unique within one import`);
        delete r.data;
      }
    }
  }
  return { fileError: null, rows };
}
