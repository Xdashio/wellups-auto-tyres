import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// GATE 026 — business-data safety guards: production UI must never
// regress to hardcoded prototype business values. Scans customer-facing
// source (app/, customer components, landing). Patterns are assembled
// without embedding full literals so this file itself stays clean.
// Legitimate technical constants (tokens, STATIC_* fitment reference,
// "e.g." format placeholders) are intentionally NOT matched.

const ROOTS = [
  "app",
  "components/landing",
  "components/catalog",
  "components/quotes",
  "components/services",
  "components/ui",
  "components/admin",
  "lib",
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|css)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  for (const root of ROOTS) walk(path.resolve(__dirname, "..", root));
  return out;
}

// wa.me/ followed by digits (the template `wa.me/${clean}` never matches:
// no digits follow the slash in source).
const WA_LINK = new RegExp("wa\\.me/[0-9]");
// The two prototype numbers, split so this file holds no literal.
const PROTO_NUMBERS = ["254748088741", "254711000000"].map(
  (n) => new RegExp(n.slice(0, 6) + n.slice(6))
);
const STREETS = /commercial st|mpaka rd|enterprise road|waiyaki way|sameer|sarit/i;
const CITY_CLAIM = /nairobi/i;
const DEMO_BRANDS = /pirelli|bridgestone|michelin|continental|goodyear|castrol/i;
const NATIVE_DIALOG = /[^_a-zA-Z](confirm|alert)\s*\(/;

describe("GATE 026 — no hardcoded business data in customer-facing source", () => {
  it("no WhatsApp deep links with literal numbers", () => {
    const hits = sourceFiles().filter((f) => WA_LINK.test(fs.readFileSync(f, "utf-8")));
    expect(hits, `wa.me links with literal numbers: ${hits.join(", ")}`).toEqual([]);
  });

  it("no prototype phone numbers", () => {
    const hits = sourceFiles().filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return PROTO_NUMBERS.some((re) => re.test(content));
    });
    expect(hits, `prototype numbers: ${hits.join(", ")}`).toEqual([]);
  });

  it("no prototype street/landmark addresses", () => {
    const hits = sourceFiles().filter((f) => STREETS.test(fs.readFileSync(f, "utf-8")));
    expect(hits, `prototype addresses: ${hits.join(", ")}`).toEqual([]);
  });

  it("no city claim in UI source", () => {
    const hits = sourceFiles().filter((f) => CITY_CLAIM.test(fs.readFileSync(f, "utf-8")));
    expect(hits, `city claims: ${hits.join(", ")}`).toEqual([]);
  });

  it("no prototype statistics or branch-count claims", () => {
    const hits = sourceFiles().filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      // "4.8" also matches versions/widths — only flag the rating context
      // plus the unambiguous years/branch claims.
      return /15\+|two branches/i.test(content) || /4\.8.{0,20}rating|rating.{0,20}4\.8/i.test(content);
    });
    expect(hits, `stat claims: ${hits.join(", ")}`).toEqual([]);
  });

  it("no prototype demo brand names", () => {
    const hits = sourceFiles().filter((f) => DEMO_BRANDS.test(fs.readFileSync(f, "utf-8")));
    expect(hits, `demo brands: ${hits.join(", ")}`).toEqual([]);
  });

  it("no native confirm()/alert() in product UI", () => {
    const hits = sourceFiles().filter((f) => {
      // The guard component documents what it replaces; it calls neither.
      if (path.basename(f) === "confirmation-dialog.tsx") return false;
      return NATIVE_DIALOG.test(fs.readFileSync(f, "utf-8"));
    });
    expect(hits, `native dialogs: ${hits.join(", ")}`).toEqual([]);
  });
});
