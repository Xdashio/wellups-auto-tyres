import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseCsv } from "@/lib/catalog/csv-parse";
import {
  validateProductRows,
  validateServiceRows,
} from "@/lib/catalog/csv-import";

const BRANCH_ID = "123e4567-e89b-42d3-a456-426614174000";
const CATEGORIES = [
  { id: "123e4567-e89b-42d3-a456-426614174001", name: "Tyres" },
  { id: "123e4567-e89b-42d3-a456-426614174002", name: "Batteries" },
];

function productCsv(body: string): { headers: string[]; records: { lineNumber: number; values: string[] }[] } {
  return parseCsv(
    "name,sku,category,brand,size_spec,cost_price,sell_price,stock_quantity,status\n" + body
  );
}

function serviceCsv(body: string): { headers: string[]; records: { lineNumber: number; values: string[] }[] } {
  return parseCsv("name,description,vehicle_types,is_available\n" + body);
}

describe("csv parser", () => {
  it("parses simple rows and trims headers", () => {
    const { headers, records } = parseCsv(" Name , SKU \na,b\nc,d\n");
    expect(headers).toEqual(["Name", "SKU"]);
    expect(records.map((r) => r.values)).toEqual([["a", "b"], ["c", "d"]]);
    expect(records[0].lineNumber).toBe(2);
  });

  it("handles quoted commas, escaped quotes, and CRLF", () => {
    const { records } = parseCsv('a,b\r\n"x, y","q""q"\r\n');
    expect(records.map((r) => r.values)).toEqual([["x, y", 'q"q']]);
  });

  it("handles newlines inside quoted fields and blank lines", () => {
    const { records } = parseCsv('a\n"line1\nline2",b\n\n\nc,d\n');
    expect(records).toHaveLength(2);
    expect(records[0].values).toEqual(["line1\nline2", "b"]);
    expect(records[1].lineNumber).toBe(6);
  });

  it("strips a BOM and rejects unterminated quotes", () => {
    expect(parseCsv("﻿a\nb").headers).toEqual(["a"]);
    expect(() => parseCsv('a\n"x,y')).toThrow(/Unterminated quoted field/);
  });

  it("returns empty for headerless/empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], records: [] });
  });
});

describe("product row validation", () => {
  const good = "Road Tyre 205/55R16,RT-001,Tyres,BrandX,205/55R16,8000,9500,12,active";

  it("accepts a fully valid row and maps category name to id", () => {
    const { headers, records } = productCsv(good);
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.fileError).toBeNull();
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].status).toBe("valid");
    expect(out.rows[0].data).toMatchObject({
      branch_id: BRANCH_ID,
      category_id: "123e4567-e89b-42d3-a456-426614174001",
      sku: "RT-001",
      status: "active",
      stock_quantity: 12,
    });
  });

  it("reports missing headers as a file-level error", () => {
    const { headers, records } = parseCsv("name,sku\nA,B");
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.fileError).toMatch(/Missing required columns/);
    expect(out.rows).toEqual([]);
  });

  it("flags each invalid row with the specific error", () => {
    const { headers, records } = productCsv(
      ",MISSING-NAME,Tyres,,,0,0,0,active\n" + // missing name
        "Bad Status,BS-1,Tyres,,,0,0,0,bogus\n" + // bad enum
        "Neg Price,NP-1,Tyres,,,0,-5,0,active\n" + // negative sell
        "Frac Stock,FS-1,Tyres,,,0,0,2.5,active\n" + // non-integer stock
        "No Category,NC-1,Nope,,,0,0,0,active" // unknown category
    );
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.rows.every((r) => r.status === "invalid")).toBe(true);
    expect(out.rows[0].errors.join(" ")).toMatch(/name/);
    expect(out.rows[1].errors.join(" ")).toMatch(/status/);
    expect(out.rows[2].errors.join(" ")).toMatch(/sell_price/);
    expect(out.rows[3].errors.join(" ")).toMatch(/stock_quantity/);
    expect(out.rows[4].errors.join(" ")).toMatch(/category/);
  });

  it("rejects SEED- and SAMPLE-prefixed names (never silently skips)", () => {
    const { headers, records } = productCsv(
      "SEED Demo Tyre,SEED-X,Tyres,,,0,0,0,active\nSAMPLE Demo,SAMPLE-X,Tyres,,,0,0,0,active"
    );
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.rows.map((r) => r.status)).toEqual(["invalid", "invalid"]);
    expect(out.rows[0].errors.join(" ")).toMatch(/SEED/);
    expect(out.rows[1].errors.join(" ")).toMatch(/SAMPLE/);
  });

  it("rejects duplicate SKUs within one file", () => {
    const { headers, records } = productCsv(`${good}\nRoad Tyre Copy,RT-001,Tyres,,,0,0,1,active`);
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.rows.map((r) => r.status)).toEqual(["invalid", "invalid"]);
    expect(out.rows[0].errors.join(" ")).toMatch(/duplicate/);
  });

  it("matches headers case-insensitively", () => {
    const { headers, records } = parseCsv(
      "Name,SKU,Category,Brand,Size_Spec,Cost_Price,Sell_Price,Stock_Quantity,Status\n" + good
    );
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    expect(out.fileError).toBeNull();
    expect(out.rows[0].status).toBe("valid");
  });
});

describe("service row validation", () => {
  it("accepts a valid row, splitting vehicle types and defaulting availability", () => {
    const { headers, records } = serviceCsv("Wheel Alignment,Laser alignment,Sedan; SUV ,");
    const out = validateServiceRows(headers, records);
    expect(out.fileError).toBeNull();
    expect(out.rows[0].status).toBe("valid");
    expect(out.rows[0].data).toMatchObject({
      name: "Wheel Alignment",
      vehicle_types: ["Sedan", "SUV"],
      is_available: true,
    });
  });

  it("parses explicit false availability and rejects garbage", () => {
    const { headers, records } = serviceCsv("Alignment Check,,Sedan,no\nBrake Check,,,maybe");
    const out = validateServiceRows(headers, records);
    expect(out.rows[0].status).toBe("valid");
    expect(out.rows[0].data!.is_available).toBe(false);
    expect(out.rows[1].status).toBe("invalid");
    expect(out.rows[1].errors.join(" ")).toMatch(/is_available/);
  });

  it("rejects SEED names and in-file duplicate names", () => {
    const { headers, records } = serviceCsv("SEED Polish,desc,,true\nBrake Check,desc,,true\nBrake Check,other,,true");
    const out = validateServiceRows(headers, records);
    expect(out.rows[0].status).toBe("invalid");
    expect(out.rows[0].errors.join(" ")).toMatch(/SEED/);
    expect(out.rows[1].status).toBe("invalid");
    expect(out.rows[2].status).toBe("invalid");
    expect(out.rows[1].errors.join(" ")).toMatch(/duplicate/);
  });

  it("the shipped services template example row is refused, not imported", () => {
    const text = fs.readFileSync(
      path.resolve(import.meta.dirname, "../public/import-templates/services.csv"),
      "utf-8"
    );
    const { headers, records } = parseCsv(text);
    const out = validateServiceRows(headers, records);
    expect(out.rows.length).toBeGreaterThan(0);
    expect(out.rows.every((r) => r.status === "invalid")).toBe(true);
  });

  it("the shipped products template example row is refused, not imported", () => {
    const text = fs.readFileSync(
      path.resolve(import.meta.dirname, "../public/import-templates/products.csv"),
      "utf-8"
    );
    const { headers, records } = parseCsv(text);
    const out = validateProductRows(headers, records, { branchId: BRANCH_ID, categories: CATEGORIES });
    // The template's example category may legitimately differ from live
    // taxonomy — either way the row must NEVER validate as importable.
    expect(
      out.fileError !== null || out.rows.every((r) => r.status === "invalid")
    ).toBe(true);
  });
});
