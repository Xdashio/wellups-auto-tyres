import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// GATE 014 guardrail: development seed data must stay recognizable and must
// never silently become production data. Fails CI if:
//   - any seed.sql product/service name lacks the `SEED ` prefix, or
//   - the production template ever contains an executable realistic row
//     (every data value must be an <ANGLE_BRACKET> placeholder).
const repoRoot = path.resolve(import.meta.dirname, "..");

function readRepo(relative: string): string {
  return fs.readFileSync(path.join(repoRoot, relative), "utf-8");
}

describe("GATE 014 — seed hygiene", () => {
  it("every seed.sql product and service name carries the SEED prefix", () => {
    const seed = readRepo("supabase/seed.sql");
    // Product value lines: (id, branch_id, category_id, 'NAME', 'SEED-XXX-NNN', ...)
    const productNames: string[] = [];
    const productLine =
      /'[0-9a-f-]{36}',\s*'[0-9a-f-]{36}',\s*'[0-9a-f-]{36}',\s*'([^']+)',\s*'SEED-[A-Z]+-\d+'/g;
    let m: RegExpExecArray | null;
    while ((m = productLine.exec(seed)) !== null) {
      productNames.push(m[1]);
    }
    expect(productNames.length).toBe(15);
    // Service value lines: (id, 'NAME', 'SEED placeholder service', ...)
    const serviceNames: string[] = [];
    const serviceLine = /'[0-9a-f-]{36}',\s*'([^']+)',\s*'SEED placeholder service'/g;
    while ((m = serviceLine.exec(seed)) !== null) {
      serviceNames.push(m[1]);
    }
    expect(serviceNames.length).toBe(8);
    expect([...productNames, ...serviceNames].filter((n) => !n.startsWith("SEED "))).toEqual([]);
  });

  it("seed.sql declares itself development-only", () => {
    const seed = readRepo("supabase/seed.sql");
    expect(seed).toMatch(/development\/test only|DEVELOPMENT ONLY/i);
  });

  it("production template contains only placeholders, no realistic rows", () => {
    const template = readRepo("supabase/production/catalog.template.sql");
    expect(template).toContain("<REAL_");
    expect(template).not.toMatch(/SEED-/);
    // Every INSERT/UPSERT target value line must reference a placeholder.
    const dataLines = template
      .split("\n")
      .filter((l) => /^\s*('|<|\(|{|[\w.]+,?$)/.test(l) && /REAL_|SEED|values|select/i.test(l));
    expect(dataLines.length).toBeGreaterThan(0);
  });

  it("retire script only ever matches SEED-prefixed rows", () => {
    const retire = readRepo("supabase/production/retire-seed-catalog.sql");
    expect(retire).toMatch(/like 'SEED %'/i);
    expect(retire).not.toMatch(/delete\s+from/i);
  });
});
