import { describe, it, expect } from "vitest";
import { BranchSettingsSchema } from "@/lib/supabase/branch";

const base = {
  name: "Test Branch",
};

describe("GATE 012 — M-Pesa settings validation", () => {
  it("accepts a valid paybill configuration", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_channel_type: "paybill",
      mpesa_paybill_number: "400200",
      mpesa_account_number: "WELLUPS-01",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.mpesa_paybill_number).toBe("400200");
    }
  });

  it("accepts a valid till configuration", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_channel_type: "till",
      mpesa_till_number: "1234567",
    });
    expect(res.success).toBe(true);
  });

  it("preserves NULL/unconfigured state", () => {
    const res = BranchSettingsSchema.safeParse({ ...base });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.mpesa_channel_type ?? null).toBeNull();
      expect(res.data.mpesa_paybill_number ?? null).toBeNull();
      expect(res.data.mpesa_till_number ?? null).toBeNull();
      expect(res.data.mpesa_account_number ?? null).toBeNull();
    }
  });

  it("normalizes empty strings to NULL", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_paybill_number: "   ",
      mpesa_account_number: "",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.mpesa_paybill_number).toBeNull();
      expect(res.data.mpesa_account_number).toBeNull();
    }
  });

  it("trims surrounding whitespace on valid numbers", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_channel_type: "till",
      mpesa_till_number: "  123456 ",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.mpesa_till_number).toBe("123456");
    }
  });

  it("rejects non-numeric paybill values", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_channel_type: "paybill",
      mpesa_paybill_number: "abc",
    });
    expect(res.success).toBe(false);
  });

  it("rejects too-short and too-long numbers", () => {
    for (const bad of ["1234", "12345678", "12 34", "+254700000000"]) {
      const res = BranchSettingsSchema.safeParse({
        ...base,
        mpesa_till_number: bad,
      });
      expect(res.success, bad).toBe(false);
    }
  });

  it("rejects control characters", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_paybill_number: "123\u000745",
    });
    expect(res.success).toBe(false);
  });

  it("rejects malformed account numbers", () => {
    for (const bad of ["ACCT;DROP", "a".repeat(33), "name\ninjected"]) {
      const res = BranchSettingsSchema.safeParse({
        ...base,
        mpesa_account_number: bad,
      });
      expect(res.success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("rejects unknown channel types", () => {
    const res = BranchSettingsSchema.safeParse({
      ...base,
      mpesa_channel_type: "momo",
    });
    expect(res.success).toBe(false);
  });
});
