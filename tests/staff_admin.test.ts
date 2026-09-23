import { describe, it, expect } from "vitest";
import { StaffInviteSchema, StaffRoleSchema } from "@/lib/supabase/staff-admin";

// Unit tests for the staff-admin client validation. RPC round-trips are
// covered by supabase/tests/017_staff_admin.test.sql (pgTAP, scratch DB)
// and tests/staff_admin_live.test.ts (boundaries against the live project
// once 017 is pushed) — never fabricated here.

describe("staff role schema", () => {
  it("accepts exactly admin, manager, cashier", () => {
    for (const role of ["admin", "manager", "cashier"]) {
      expect(StaffRoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("rejects anything else, including Owner", () => {
    for (const role of ["owner", "Admin", "ADMIN", "", null, undefined]) {
      expect(StaffRoleSchema.safeParse(role).success).toBe(false);
    }
  });
});

describe("staff invite schema", () => {
  it("accepts a well-formed invite and trims the email", () => {
    const out = StaffInviteSchema.safeParse({
      email: "  Jane@Example.COM  ",
      role: "manager",
      displayName: "Jane",
    });
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.email).toBe("Jane@Example.COM");
      expect(out.data.role).toBe("manager");
    }
  });

  it("rejects malformed emails with a specific error", () => {
    for (const email of ["not-an-email", "a@b", "@x.com", "a b@c.com", ""]) {
      const out = StaffInviteSchema.safeParse({ email, role: "cashier" });
      expect(out.success).toBe(false);
    }
  });

  it("rejects unknown roles on invite", () => {
    const out = StaffInviteSchema.safeParse({ email: "a@b.co", role: "owner" });
    expect(out.success).toBe(false);
  });

  it("treats an empty display name as absent", () => {
    const out = StaffInviteSchema.safeParse({
      email: "a@b.co",
      role: "cashier",
      displayName: "   ",
    });
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.displayName).toBeUndefined();
  });
});
