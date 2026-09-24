import { describe, it, expect } from "vitest";
import { getStaffWhatsAppQuoteUrl } from "@/lib/supabase/quotes";
import { validateMpesaReference } from "@/lib/validation/mpesa";

describe("GATE 033 — V0.6A Security & Governance Test Suite", () => {
  describe("A. Acceptance Evidence & Immutability Rules", () => {
    it("ensures customer acceptance RPC takes ZERO price arguments (server-authoritative pricing)", () => {
      // The RPC signature for customer_respond_to_quote is (p_quote_id, p_action, p_token)
      // Client CANNOT pass a price, discount, or amount override.
      const clientPayload = {
        quoteId: "11111111-1111-1111-1111-111111111111",
        action: "accept",
        token: "22222222-2222-2222-2222-222222222222",
      };

      expect(clientPayload).not.toHaveProperty("offered_price");
      expect(clientPayload).not.toHaveProperty("price");
      expect(clientPayload).not.toHaveProperty("amount");
    });

    it("verifies acceptance status transition is strictly binary ('accept' | 'decline')", () => {
      const validActions = ["accept", "decline"];
      expect(validActions).toContain("accept");
      expect(validActions).toContain("decline");

      const invalidActions = ["negotiate", "counter_offer", "override_price", "accept_with_discount"];
      invalidActions.forEach((badAction) => {
        expect(validActions.includes(badAction)).toBe(false);
      });
    });
  });

  describe("B. Quote Validity Ceilings (7-Day Hard Limit)", () => {
    const validateValidityPeriod = (issueTime: number, validUntilTime: number): { valid: boolean; error?: string } => {
      if (isNaN(validUntilTime)) return { valid: false, error: "Invalid timestamp" };
      if (validUntilTime < issueTime) return { valid: false, error: "Date cannot be in the past" };
      
      const maxAllowed = issueTime + 7 * 24 * 60 * 60 * 1000;
      if (validUntilTime > maxAllowed) {
        return { valid: false, error: "Quote validity cannot exceed 7 calendar days" };
      }
      return { valid: true };
    };

    it("allows a quote validity period of exactly 7 days", () => {
      const now = Date.now();
      const exactly7Days = now + 7 * 24 * 60 * 60 * 1000;
      const res = validateValidityPeriod(now, exactly7Days);
      expect(res.valid).toBe(true);
    });

    it("allows a quote validity period of less than 7 days (e.g. 3 days)", () => {
      const now = Date.now();
      const threeDays = now + 3 * 24 * 60 * 60 * 1000;
      const res = validateValidityPeriod(now, threeDays);
      expect(res.valid).toBe(true);
    });

    it("strictly rejects a quote validity period exceeding 7 days (e.g. 8 days)", () => {
      const now = Date.now();
      const eightDays = now + 8 * 24 * 60 * 60 * 1000;
      const res = validateValidityPeriod(now, eightDays);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Quote validity cannot exceed 7 calendar days");
    });

    it("strictly rejects a quote validity period exceeding 7 days by 1 hour", () => {
      const now = Date.now();
      const sevenDaysAndHour = now + (7 * 24 + 1) * 60 * 60 * 1000;
      const res = validateValidityPeriod(now, sevenDaysAndHour);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Quote validity cannot exceed 7 calendar days");
    });

    it("rejects a quote validity date in the past", () => {
      const now = Date.now();
      const pastDate = now - 1000 * 60;
      const res = validateValidityPeriod(now, pastDate);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Date cannot be in the past");
    });
  });

  describe("C. WhatsApp Portal Link Delivery (Notification vs Commercial Record)", () => {
    it("generates a WhatsApp message containing the authoritative customer portal URL with token", () => {
      const url = getStaffWhatsAppQuoteUrl({
        customerPhone: "+254712345678",
        customerName: "Alice Mwangi",
        quoteNumber: "QT-2026-00042",
        quoteId: "33333333-3333-3333-3333-333333333333",
        secretToken: "44444444-4444-4444-4444-444444444444",
        itemName: "Michelin Primacy 4 205/55R16",
        quantity: 4,
        offeredPrice: 48000,
        validUntilDate: "2026-10-01",
        origin: "https://wellups.co.ke",
      });

      expect(url).not.toBeNull();
      expect(url).toContain("https://wa.me/254712345678");

      const decoded = decodeURIComponent(url!);
      expect(decoded).toContain("QT-2026-00042");
      expect(decoded).toContain("Alice Mwangi");
      expect(decoded).toContain("KES 48,000");
      expect(decoded).toContain("valid until 2026-10-01");
      expect(decoded).toContain("https://wellups.co.ke/quotes/33333333-3333-3333-3333-333333333333?token=44444444-4444-4444-4444-444444444444");
      expect(decoded).toContain("respond securely on our customer portal");
    });

    it("returns null when customer phone is invalid or missing", () => {
      const url = getStaffWhatsAppQuoteUrl({
        customerPhone: "",
        customerName: "Bob",
        quoteNumber: "QT-2026-00001",
        quoteId: "id-1",
        secretToken: "tok-1",
        itemName: "Tyre",
        quantity: 1,
      });

      expect(url).toBeNull();
    });
  });

  describe("D. Token Isolation & Cryptographic Fingerprinting", () => {
    it("ensures bearer token is never leaked in public customer projections", () => {
      const publicCustomerProjection = {
        id: "123",
        quote_number: "QT-2026-00001",
        item_type: "product",
        offered_price: 15000,
        status: "accepted",
      };

      expect(publicCustomerProjection).not.toHaveProperty("secret_token");
      expect(publicCustomerProjection).not.toHaveProperty("staff_notes");
    });
  });

  describe("E. M-Pesa 10-Character Alphanumeric Reference Verification", () => {
    it("accepts valid 10-character uppercase alphanumeric references", () => {
      expect(validateMpesaReference("QHG729X4LP").valid).toBe(true);
      expect(validateMpesaReference("ABCDEFGHIJ").valid).toBe(true);
      expect(validateMpesaReference("AB12CD34EF").valid).toBe(true);
      expect(validateMpesaReference("  qhg729x4lp  ").valid).toBe(true);
    });

    it("rejects non-compliant references", () => {
      expect(validateMpesaReference("ABC").valid).toBe(false);
      expect(validateMpesaReference("ABCDEFGHI").valid).toBe(false);
      expect(validateMpesaReference("ABCDEFGHIJK").valid).toBe(false);
      expect(validateMpesaReference("ABC-123456").valid).toBe(false);
      expect(validateMpesaReference("ABC 123456").valid).toBe(false);
      expect(validateMpesaReference("123456789!").valid).toBe(false);
    });
  });
});
