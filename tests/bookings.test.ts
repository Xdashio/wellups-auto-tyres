import { describe, it, expect } from "vitest";
import {
  createBookingSchema,
  staffBookingActionSchema,
  BookingStatus,
} from "../lib/supabase/bookings";

describe("v0.4 Service Booking Logic & Zod Validation Tests", () => {
  describe("createBookingSchema", () => {
    const validBase = {
      serviceId: "10000000-0000-0000-0000-000000000001",
      customerName: "Jane Doe",
      customerPhone: "+254712345678",
      customerEmail: "jane@example.com",
      requestedDate: "2026-09-25",
      requestedTime: "10:30",
      vehicleSummary: "Toyota Prado KCA 123X",
      customerNotes: "Check front brake noise",
    };

    it("accepts valid booking input", () => {
      const parsed = createBookingSchema.safeParse(validBase);
      expect(parsed.success).toBe(true);
    });

    it("accepts booking without optional fields", () => {
      const parsed = createBookingSchema.safeParse({
        serviceId: "10000000-0000-0000-0000-000000000001",
        customerName: "Jane Doe",
        customerPhone: "0712345678",
        requestedDate: "2026-09-25",
        requestedTime: "14:00",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects missing or empty customer name", () => {
      const res1 = createBookingSchema.safeParse({ ...validBase, customerName: "" });
      expect(res1.success).toBe(false);

      const res2 = createBookingSchema.safeParse({ ...validBase, customerName: "   " });
      expect(res2.success).toBe(false);
    });

    it("rejects customer name longer than 100 characters", () => {
      const res = createBookingSchema.safeParse({ ...validBase, customerName: "A".repeat(101) });
      expect(res.success).toBe(false);
    });

    it("rejects missing or short customer phone", () => {
      const res1 = createBookingSchema.safeParse({ ...validBase, customerPhone: "" });
      expect(res1.success).toBe(false);

      const res2 = createBookingSchema.safeParse({ ...validBase, customerPhone: "123" });
      expect(res2.success).toBe(false);
    });

    it("validates customer email format when provided", () => {
      const resInvalid = createBookingSchema.safeParse({ ...validBase, customerEmail: "invalid-email" });
      expect(resInvalid.success).toBe(false);

      const resEmpty = createBookingSchema.safeParse({ ...validBase, customerEmail: "" });
      expect(resEmpty.success).toBe(true);
    });

    it("validates requestedDate format strictly as YYYY-MM-DD", () => {
      expect(createBookingSchema.safeParse({ ...validBase, requestedDate: "2026-09-25" }).success).toBe(true);
      expect(createBookingSchema.safeParse({ ...validBase, requestedDate: "25/09/2026" }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...validBase, requestedDate: "2026-9-25" }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...validBase, requestedDate: "tomorrow" }).success).toBe(false);
    });

    it("validates requestedTime strictly as 24-hour HH:MM format", () => {
      const validTimes = ["00:00", "08:30", "09:00", "12:15", "14:45", "23:59"];
      validTimes.forEach((time) => {
        const res = createBookingSchema.safeParse({ ...validBase, requestedTime: time });
        expect(res.success).toBe(true);
      });

      const invalidTimes = ["24:00", "25:30", "09:60", "9:30", "14:5", "noon", "14:00:00"];
      invalidTimes.forEach((time) => {
        const res = createBookingSchema.safeParse({ ...validBase, requestedTime: time });
        expect(res.success).toBe(false);
      });
    });

    it("rejects invalid serviceId (non-uuid)", () => {
      const res = createBookingSchema.safeParse({ ...validBase, serviceId: "not-a-uuid" });
      expect(res.success).toBe(false);
    });
  });

  describe("staffBookingActionSchema", () => {
    const validAction = {
      bookingId: "10000000-0000-0000-0000-000000000001",
      status: "under_review" as BookingStatus,
      staffNotes: "Bay 3 assigned",
    };

    it("accepts valid staff action payload", () => {
      const res = staffBookingActionSchema.safeParse(validAction);
      expect(res.success).toBe(true);
    });

    it("accepts all defined BookingStatus values", () => {
      const statuses: BookingStatus[] = [
        "new",
        "under_review",
        "scheduled",
        "completed",
        "cancelled",
        "declined",
      ];
      statuses.forEach((status) => {
        const res = staffBookingActionSchema.safeParse({ ...validAction, status });
        expect(res.success).toBe(true);
      });
    });

    it("rejects undefined or invalid status", () => {
      const res = staffBookingActionSchema.safeParse({ ...validAction, status: "quoted" });
      expect(res.success).toBe(false);
    });
  });

  describe("Booking Reference Number Format", () => {
    it("validates sequential reference number pattern BK-YYYY-XXXXX", () => {
      const bookingNumberRegex = /^BK-\d{4}-\d{5}$/;
      expect("BK-2026-00001").toMatch(bookingNumberRegex);
      expect("BK-2026-00123").toMatch(bookingNumberRegex);
      expect("QT-2026-00001").not.toMatch(bookingNumberRegex);
      expect("BK-26-01").not.toMatch(bookingNumberRegex);
    });
  });
});
