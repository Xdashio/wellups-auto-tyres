import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// GATE 026B — CSS architecture guards. The fit-finder "native menu" bug
// class: an unlayered global `* { margin/padding: 0 }` reset outranks
// every Tailwind utility (unlayered styles beat @layer utilities at any
// specificity) and silently strips all spacing site-wide. These guards
// pin the structural fix, not individual values.
const LANDING_CSS = path.resolve(__dirname, "../components/landing/landing.css");

function css(): string {
  const raw = fs.readFileSync(LANDING_CSS, "utf-8");
  // Comments are not rules (this file documents the ban itself).
  return raw.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("GATE 026B — no unlayered global reset", () => {
  it("landing.css has no * margin/padding reset", () => {
    const src = css();
    // Matches `* { ... margin: 0 ... padding: 0 ... }` in any order,
    // including the `*, *::before, *::after` variant.
    expect(src).not.toMatch(/\*\s*(,\s*\*::(before|after)\s*)*\{[^}]*margin\s*:\s*0/);
    expect(src).not.toMatch(/\*\s*(,\s*\*::(before|after)\s*)*\{[^}]*padding\s*:\s*0/);
  });

  it("element base rules live in @layer base", () => {
    const src = css();
    // The file must declare a base layer for its html/body rules so the
    // Tailwind layer order governs them.
    expect(src).toMatch(/@layer base/);
  });

  it("hero content cannot force grid blowout", () => {
    const src = css();
    expect(src).toMatch(/\.hero-content\s*\{[^}]*min-width\s*:\s*0/);
  });

  it("hero trust row wraps on narrow screens", () => {
    const src = css();
    expect(src).toMatch(/\.hero-trust\s*\{[^}]*flex-wrap\s*:\s*wrap/);
  });
});
