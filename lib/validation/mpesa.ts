import { z } from "zod";

export const MPESA_REFERENCE_REGEX = /^[A-Z0-9]{10}$/;

/**
 * Normalizes an M-Pesa transaction reference:
 * - Trims leading and trailing whitespace
 * - Converts to uppercase
 */
export function normalizeMpesaReference(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim().toUpperCase();
}

/**
 * Validates a normalized M-Pesa transaction reference according to business rules:
 * - Exactly 10 characters
 * - Alphanumeric characters only [A-Z0-9]
 * - No punctuation, spaces, or lowercase after normalization
 */
export function validateMpesaReference(input: string | null | undefined): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeMpesaReference(input);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: "M-Pesa transaction reference is required.",
    };
  }

  if (normalized.length !== 10) {
    return {
      valid: false,
      normalized,
      error: `M-Pesa reference must be exactly 10 characters (received ${normalized.length}).`,
    };
  }

  if (!MPESA_REFERENCE_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "M-Pesa reference must contain only uppercase letters (A-Z) and digits (0-9).",
    };
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Zod schema for M-Pesa reference input validation
 */
export const MpesaReferenceSchema = z
  .string()
  .transform((val) => normalizeMpesaReference(val))
  .refine((val) => MPESA_REFERENCE_REGEX.test(val), {
    message: "M-Pesa reference must be exactly 10 alphanumeric characters (e.g. QHG729X4LP).",
  });
