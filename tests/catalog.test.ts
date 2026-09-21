import { describe, it, expect } from "vitest";
import { getQualitativeStockStatus, getWhatsAppQuoteUrl } from "../lib/supabase/catalog";

describe("Catalog Logic & Helpers", () => {
  it("converts status enum to qualitative badge format without exposing exact numbers", () => {
    expect(getQualitativeStockStatus("in_stock")).toEqual({ label: "In Stock", tone: "success" });
    expect(getQualitativeStockStatus("low_stock")).toEqual({ label: "Low Stock", tone: "warning" });
    expect(getQualitativeStockStatus("out_of_stock")).toEqual({ label: "Out of Stock", tone: "error" });
  });

  it("builds valid WhatsApp quote deep link", () => {
    const url = getWhatsAppQuoteUrl("254712345678", "SEED All-Terrain Tyre", "SEED-TYR-001", "265/65R17");
    expect(url).not.toBeNull();
    expect(url).toContain("https://wa.me/254712345678");
    expect(url).toContain(encodeURIComponent("SEED All-Terrain Tyre"));
    expect(url).toContain(encodeURIComponent("265/65R17"));
  });
});
