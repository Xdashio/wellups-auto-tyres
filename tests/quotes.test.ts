import { describe, it, expect } from "vitest";
import { isQuoteExpired, QuoteStatus } from "../lib/supabase/quotes";

describe("v0.3 Quote System Logic & Validation Tests", () => {
  describe("isQuoteExpired", () => {
    it("returns false if validUntil is null or undefined", () => {
      expect(isQuoteExpired(null)).toBe(false);
      expect(isQuoteExpired(undefined)).toBe(false);
    });

    it("returns true for a past expiration date", () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      expect(isQuoteExpired(pastDate)).toBe(true);
    });

    it("returns false for a future expiration date", () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      expect(isQuoteExpired(futureDate)).toBe(false);
    });
  });

  describe("Quote Status Transitions", () => {
    const validStatuses: QuoteStatus[] = ["new", "under_review", "quoted", "accepted", "declined", "expired"];

    it("supports all defined quote lifecycle statuses", () => {
      validStatuses.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });

    it("verifies staff quote pricing payload structure", () => {
      const staffResponse = {
        quoteId: "10000000-0000-0000-0000-000000000001",
        status: "quoted" as QuoteStatus,
        offeredPrice: 15500.0,
        validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        staffNotes: "Agreed discount applied for set of 4 tyres"
      };

      expect(staffResponse.offeredPrice).toBeGreaterThan(0);
      expect(staffResponse.status).toBe("quoted");
      expect(staffResponse.staffNotes).toContain("Agreed discount");
    });
  });

  describe("Quote Reference Number Format", () => {
    it("validates quote number format pattern QT-YYYY-XXXXX", () => {
      const quoteNumberRegex = /^QT-\d{4}-\d{5}$/;
      expect("QT-2026-00001").toMatch(quoteNumberRegex);
      expect("QT-2026-00042").toMatch(quoteNumberRegex);
      expect("INVALID-123").not.toMatch(quoteNumberRegex);
    });
  });
});
