"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { parseCsv } from "@/lib/catalog/csv-parse";
import {
  validateProductRows,
  validateServiceRows,
  type CategoryRef,
  type ValidatedRow,
} from "@/lib/catalog/csv-import";
import type {
  ProductInput,
  ServiceInput,
} from "@/lib/supabase/catalog-admin";
import type { BulkUpsertResult } from "@/lib/supabase/catalog-import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ImportKind = "products" | "services";

interface CsvImporterProps<T extends ProductInput | ServiceInput> {
  kind: ImportKind;
  branchId: string;
  categories: CategoryRef[];
  templateHref: string;
  onImport: (
    accessToken: string,
    rows: T[]
  ) => Promise<BulkUpsertResult>;
}

export function CsvImporter<T extends ProductInput | ServiceInput>({ kind, branchId, categories, templateHref, onImport }: CsvImporterProps<T>) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidatedRow<T>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkUpsertResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isProducts = kind === "products";
  const validRows = (rows ?? []).filter((r) => r.status === "valid");
  const invalidRows = (rows ?? []).filter((r) => r.status === "invalid");

  const handleFile = async (file: File | undefined) => {
    setResult(null);
    setImportError(null);
    setRows(null);
    setFileError(null);
    if (!file) return;
    setFileName(file.name);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError("Could not read that file. Choose a plain .csv file and try again.");
      return;
    }
    let parsed;
    try {
      parsed = parseCsv(text);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Could not parse that CSV file.");
      return;
    }
    if (parsed.headers.length === 0 || parsed.records.length === 0) {
      setFileError("That file has no data rows. Download the template below for the correct format.");
      return;
    }
    const validated = isProducts
      ? validateProductRows(parsed.headers, parsed.records, { branchId, categories })
      : validateServiceRows(parsed.headers, parsed.records);
    if (validated.fileError) {
      setFileError(validated.fileError);
      return;
    }
    setRows(validated.rows as ValidatedRow<T>[]);
  };

  const handleImport = async () => {
    const valid = validRows.filter((r) => r.data).map((r) => r.data!);
    if (valid.length === 0) return;
    if (
      !confirm(
        `Import ${valid.length} valid ${isProducts ? "product" : "service"} row${valid.length === 1 ? "" : "s"}? ` +
          (isProducts
            ? "Existing SKUs will be UPDATED in place; new SKUs will be created."
            : "Existing names will be UPDATED in place; new names will be created.") +
          (invalidRows.length > 0 ? ` ${invalidRows.length} invalid row${invalidRows.length === 1 ? " will be" : "s will be"} left out.` : "")
      )
    ) {
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      if (!accessToken) {
        setImportError("Sign in as a staff member before importing. Catalog writes are admin-only.");
        return;
      }
      const res = await onImport(accessToken, valid as T[]);
      setResult(res);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-3">
        <h2 className="font-bold">1. Get the template</h2>
        <p className="text-sm text-text-secondary">
          {isProducts ? (
            <>
              Columns: <span className="font-mono text-xs">name, sku, category, brand, size_spec, cost_price, sell_price, stock_quantity, status</span>.
              Category must match an existing category exactly ({categories.length} available: {categories.map((c) => c.name).join(", ") || "none yet"}).
              Status must be one of: active, in_stock, low_stock, out_of_stock. All rows bind to the single branch automatically.
            </>
          ) : (
            <>
              Columns: <span className="font-mono text-xs">name, description, vehicle_types, is_available</span>.
              Separate vehicle types with semicolons (e.g. <span className="font-mono text-xs">Sedan;SUV;Pickup</span>).
              is_available accepts true/false (empty means available).
            </>
          )}{" "}
          Rows whose name starts with <span className="font-mono text-xs">SEED&nbsp;</span> or <span className="font-mono text-xs">SAMPLE&nbsp;</span> are
          refused — demo rows can never be imported.
        </p>
        <a
          href={templateHref}
          download
          className="inline-block text-sm font-semibold text-primary hover:underline"
        >
          Download {isProducts ? "products" : "services"} CSV template
        </a>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-bold">2. Upload + dry-run preview</h2>
        <input
          data-testid="csv-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary-hover file:cursor-pointer"
        />
        {fileName && (
          <p className="text-xs text-text-secondary">
            File: <span className="font-mono">{fileName}</span>
          </p>
        )}
        {fileError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {fileError}
          </div>
        )}
        {rows && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="success">{validRows.length} valid</Badge>
              <Badge tone={invalidRows.length > 0 ? "error" : "neutral"}>{invalidRows.length} invalid</Badge>
              <span className="text-xs text-text-secondary">
                Nothing has been written — review below, then confirm.
              </span>
            </div>
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">{isProducts ? "SKU" : "Name"}</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-t border-border ${r.status === "valid" ? "bg-success/5" : "bg-destructive/5"}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.lineNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                      <td className="px-3 py-2">
                        <Badge tone={r.status === "valid" ? "success" : "error"}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.status === "valid" ? (
                          <span className="text-text-secondary">Ready to import</span>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5 text-destructive">
                            {r.errors.map((e, j) => (
                              <li key={j}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {rows && validRows.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="font-bold">3. Confirm import</h2>
          {importError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {importError}
            </div>
          )}
          <Button
            onClick={handleImport}
            disabled={importing}
            variant="primary"
            data-testid="csv-import-confirm"
          >
            {importing ? "Importing…" : `Import ${validRows.length} valid row${validRows.length === 1 ? "" : "s"}`}
          </Button>
          {result && (
            <div className="text-sm space-y-1">
              <p>
                <span className="font-semibold text-success">{result.created} created</span>,{" "}
                <span className="font-semibold">{result.updated} updated</span>
                {result.failed.length > 0 && (
                  <span className="font-semibold text-destructive">, {result.failed.length} failed</span>
                )}
              </p>
              {result.failed.length > 0 && (
                <ul className="list-disc list-inside text-xs text-destructive">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.key}</span>: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
