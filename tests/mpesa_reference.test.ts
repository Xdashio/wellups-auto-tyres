import { describe, it, expect } from "vitest";
import {
  normalizeMpesaReference,
  validateMpesaReference,
  MpesaReferenceSchema,
  MPESA_REFERENCE_REGEX,
} from "@/lib/validation/mpesa";

describe("GATE 033 — M-Pesa Transaction Reference Validation", () => {
  describe("Normalization", () => {
    it("trims surrounding whitespace and converts to uppercase", () => {
      expect(normalizeMpesaReference("  qhg729x4lp  ")).toBe("QHG729X4LP");
      expect(normalizeMpesaReference("  abc123def4  ")).toBe("ABC123DEF4");
      expect(normalizeMpesaReference("")).toBe("");
      expect(normalizeMpesaReference(null)).toBe("");
      expect(normalizeMpesaReference(undefined)).toBe("");
    });
  });

  describe("Validation Rule: ^[A-Z0-9]{10}$", () => {
    const validExamples = [
      "ABCDEFGHIJ",
      "AB12CD34EF",
      "QHG729X4LP",
      "  qhg729x4lp  ", // valid after normalization
      "1234567890",
      "0A1B2C3D4E",
    ];

    validExamples.forEach((ref) => {
      it(`accepts valid reference: "${ref}"`, () => {
        const res = validateMpesaReference(ref);
        expect(res.valid).toBe(true);
        expect(res.error).toBeUndefined();
        expect(res.normalized).toMatch(MPESA_REFERENCE_REGEX);
      });
    });

    const invalidExamples = [
      "ABC",            // too short (3)
      "ABCDEFGHI",      // too short (9)
      "ABCDEFGHIJK",    // too long (11)
      "ABC-123456",     // contains hyphen
      "ABC 123456",     // contains internal space
      "123456789!",     // contains punctuation
      "123456789@",     // contains symbol
      "          ",     // whitespace only
      "",               // empty string
    ];

    invalidExamples.forEach((ref) => {
      it(`rejects invalid reference: "${ref}"`, () => {
        const res = validateMpesaReference(ref);
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
      });
    });
  });

  describe("Zod Schema Validation", () => {
    it("parses valid normalized references", () => {
      const parsed = MpesaReferenceSchema.safeParse("  qhg729x4lp ");
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe("QHG729X4LP");
      }
    });

    it("rejects invalid inputs via schema", () => {
      expect(MpesaReferenceSchema.safeParse("ABC-123456").success).toBe(false);
      expect(MpesaReferenceSchema.safeParse("ABC").success).toBe(false);
      expect(MpesaReferenceSchema.safeParse("").success).toBe(false);
    });
  });
});
