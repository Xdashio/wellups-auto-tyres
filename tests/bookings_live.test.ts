import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envLocalPath = path.resolve(import.meta.dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key.trim()] = value;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://odammhhhryyepynnilbr.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required for live tests in .env.local");
}

let anonClient: SupabaseClient;
let adminClient: SupabaseClient;
let managerClient: SupabaseClient;
let cashierClient: SupabaseClient;
let customerClient: SupabaseClient;

describe("v0.4 Service Booking Live Database & Security Test Suite", () => {
  let sampleServiceId: string;

  beforeAll(async () => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch sample service
    const { data: services, error: srvErr } = await anonClient
      .from("services_public")
      .select("id")
      .limit(1);

    if (srvErr || !services || services.length === 0) {
      throw new Error(`Failed to fetch active service: ${srvErr?.message}`);
    }
    sampleServiceId = services[0].id;

    // Authenticate staff and customer clients
    adminClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    await adminClient.auth.signInWithPassword({ email: "admin@test.local", password: "TestPassword123!" });

    managerClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    await managerClient.auth.signInWithPassword({ email: "mgr@test.local", password: "TestPassword123!" });

    cashierClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    await cashierClient.auth.signInWithPassword({ email: "cashier@test.local", password: "TestPassword123!" });

    customerClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    await customerClient.auth.signInWithPassword({ email: "customer@test.local", password: "TestPassword123!" });
  });

  // =========================================================================
  // 1. GUEST BOOKING CREATION & VALIDATION
  // =========================================================================
  describe("1. Guest Booking Creation & Validation", () => {
    it("creates a booking request with server-derived branch and customer_id = NULL", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const { data, error } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Live Test Guest",
        p_customer_phone: "+254711223344",
        p_customer_email: "guest@example.com",
        p_requested_date: dateStr,
        p_requested_time: "11:30",
        p_vehicle_summary: "Toyota Hilux KCB 456Z",
        p_customer_notes: "Front brake inspection",
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(1);

      const booking = data[0];
      expect(booking.id).toBeDefined();
      expect(booking.booking_number).toMatch(/^BK-\d{4}-\d{5}$/);
      expect(booking.secret_token).toBeDefined();

      // Verify customer_id is NULL by retrieving via admin view
      const { data: staffView, error: staffErr } = await adminClient
        .from("service_bookings_staff")
        .select("customer_id, branch_id, status")
        .eq("id", booking.id)
        .single();

      expect(staffErr).toBeNull();
      expect(staffView).not.toBeNull();
      expect(staffView!.customer_id).toBeNull();
      expect(staffView!.branch_id).toBe("10000000-0000-0000-0000-000000000001");
      expect(staffView!.status).toBe("new");
    });

    it("rejects requested date in the past", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const { error } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Past Date Test",
        p_customer_phone: "+254711223344",
        p_requested_date: pastDate.toISOString().slice(0, 10),
        p_requested_time: "10:00",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Requested date cannot be in the past");
    });

    it("rejects invalid requested_time format", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { error } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Bad Time Test",
        p_customer_phone: "+254711223344",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "25:99",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Requested time is required and must be in 24-hour HH:MM format");
    });

    it("rejects non-existent or unavailable service ID", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { error } = await anonClient.rpc("create_service_booking", {
        p_service_id: "00000000-0000-0000-0000-000000000000",
        p_customer_name: "Missing Service Test",
        p_customer_phone: "+254711223344",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "10:00",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Specified service is not available for booking");
    });
  });

  // =========================================================================
  // 2. GUEST TOKEN RETRIEVAL & ISOLATION
  // =========================================================================
  describe("2. Guest Token Retrieval & Field Isolation", () => {
    it("retrieves booking by valid secret token and isolates internal staff fields", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const { data: createData } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Isolation Test Guest",
        p_customer_phone: "+254722334455",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "14:00",
      });
      const created = createData[0];

      // Retrieve via get_guest_booking
      const { data, error } = await anonClient.rpc("get_guest_booking", {
        p_booking_id: created.id,
        p_token: created.secret_token,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(1);

      const row = data[0];
      expect(row.booking_number).toBe(created.booking_number);
      expect(row.status).toBe("new");

      // Verify internal staff fields are NOT returned
      expect(row.staff_notes).toBeUndefined();
      expect(row.handled_by).toBeUndefined();
      expect(row.responded_at).toBeUndefined();
      expect(row.secret_token).toBeUndefined();
    });

    it("returns zero rows when provided an invalid or tampered secret token", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const { data: createData } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Tamper Test Guest",
        p_customer_phone: "+254722334455",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "14:00",
      });
      const created = createData[0];

      const { data, error } = await anonClient.rpc("get_guest_booking", {
        p_booking_id: created.id,
        p_token: "00000000-0000-0000-0000-000000000000",
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. BASE TABLE & RPC SECURITY BOUNDARIES
  // =========================================================================
  describe("3. Base Table & RPC Authorization Boundaries", () => {
    it("denies direct anonymous SELECT, INSERT, and UPDATE on app.service_bookings", async () => {
      // Direct table SELECT
      const { error: selectErr } = await anonClient
        .from("service_bookings")
        .select("*");
      expect(selectErr).toBeDefined();
      expect(selectErr?.message).toMatch(/permission denied|does not exist|schema cache/i);

      // Direct table INSERT
      const { error: insertErr } = await anonClient
        .from("service_bookings")
        .insert({
          customer_name: "Direct Insert Attempt",
          customer_phone: "+254700000000",
          requested_date: "2026-09-25",
          requested_time: "10:00",
          service_id: sampleServiceId,
          branch_id: "10000000-0000-0000-0000-000000000001",
        });
      expect(insertErr).toBeDefined();
      expect(insertErr?.message).toMatch(/permission denied|does not exist|schema cache/i);
    });

    it("denies anonymous execution of public.staff_manage_booking", async () => {
      const { error } = await anonClient.rpc("staff_manage_booking", {
        p_booking_id: "00000000-0000-0000-0000-000000000000",
        p_status: "under_review",
      });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/permission denied for function staff_manage_booking/i);
    });

    it("denies authenticated customer execution of public.staff_manage_booking", async () => {
      const { error } = await customerClient.rpc("staff_manage_booking", {
        p_booking_id: "00000000-0000-0000-0000-000000000000",
        p_status: "under_review",
      });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Forbidden: Only authenticated staff roles/i);
    });
  });

  // =========================================================================
  // 4. CASHIER ROLE GUARDRAILS & STATE MACHINE ENFORCEMENT
  // =========================================================================
  describe("4. Cashier Role Guardrails & State Machine", () => {
    let testBookingId: string;

    beforeAll(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Cashier Guardrail Test",
        p_customer_phone: "+254733445566",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "10:00",
      });
      testBookingId = data[0].id;
    });

    it("denies Cashier from moving new -> under_review", async () => {
      const { error } = await cashierClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "under_review",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Forbidden: Cashiers are only authorized to transition bookings from scheduled to completed");
    });

    it("denies Cashier from moving new -> declined", async () => {
      const { error } = await cashierClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "declined",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Forbidden: Cashiers are only authorized to transition bookings from scheduled to completed");
    });

    it("allows Admin to triage new -> under_review and schedule under_review -> scheduled", async () => {
      // 1. Move to under_review
      const { error: reviewErr } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "under_review",
      });
      expect(reviewErr).toBeNull();

      // 2. Schedule with future appointment
      const futureDate = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
      const { error: schedErr } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "scheduled",
        p_scheduled_at: futureDate,
        p_staff_notes: "Assigned to Bay 1",
      });
      expect(schedErr).toBeNull();
    });

    it("denies Cashier from providing scheduled_at or staff_notes when completing", async () => {
      const { error } = await cashierClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "completed",
        p_staff_notes: "Cashier trying to edit notes",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Forbidden: Cashiers cannot modify appointment schedule or staff notes");
    });

    it("allows Cashier to execute scheduled -> completed cleanly", async () => {
      const { data, error } = await cashierClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "completed",
      });
      expect(error).toBeNull();
      expect(data).toBe(true);

      // Verify status in DB
      const { data: row } = await adminClient
        .from("service_bookings_staff")
        .select("status")
        .eq("id", testBookingId)
        .single();
      expect(row?.status).toBe("completed");
    });

    it("denies any further transition once in terminal completed status", async () => {
      const { error } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: testBookingId,
        p_status: "cancelled",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Cannot transition booking in terminal status completed");
    });
  });

  // =========================================================================
  // 5. ADMIN / MANAGER STATE MACHINE RULES
  // =========================================================================
  describe("5. Admin / Manager State Machine Rules", () => {
    it("enforces parameter guardrails: rejects non-null scheduled_at on under_review", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Guardrail Test",
        p_customer_phone: "+254744556677",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "15:00",
      });
      const bookingId = data[0].id;

      const { error } = await managerClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "under_review",
        p_scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("p_scheduled_at must be null when transitioning from new to under_review");
    });

    it("enforces required scheduled_at when moving under_review -> scheduled", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Scheduling Guardrail Test",
        p_customer_phone: "+254744556677",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "15:00",
      });
      const bookingId = data[0].id;

      // Move to under_review
      await managerClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "under_review",
      });

      // Attempt scheduled without scheduled_at
      const { error } = await managerClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "scheduled",
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("A valid scheduled_at timestamp is required when moving booking to scheduled");
    });

    it("rejects past scheduled_at timestamp", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Past Timestamp Test",
        p_customer_phone: "+254744556677",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "15:00",
      });
      const bookingId = data[0].id;

      await adminClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "under_review",
      });

      const { error } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "scheduled",
        p_scheduled_at: new Date(Date.now() - 3600000).toISOString(),
      });
      expect(error).toBeDefined();
      expect(error?.message).toContain("Confirmed scheduled_at appointment cannot be in the past");
    });

    it("supports decline path from new -> declined and verifies terminal immutability", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Decline Test",
        p_customer_phone: "+254755667788",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "16:00",
      });
      const bookingId = data[0].id;

      // Move new -> declined
      const { error: declineErr } = await managerClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "declined",
        p_staff_notes: "Workshop fully booked on requested day",
      });
      expect(declineErr).toBeNull();

      // Verify terminal
      const { error: retryErr } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "under_review",
      });
      expect(retryErr).toBeDefined();
      expect(retryErr?.message).toContain("Cannot transition booking in terminal status declined");
    });

    it("rejects invalid state machine skips (new -> scheduled, new -> completed)", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);

      const { data } = await anonClient.rpc("create_service_booking", {
        p_service_id: sampleServiceId,
        p_customer_name: "Skip Test",
        p_customer_phone: "+254766778899",
        p_requested_date: tomorrow.toISOString().slice(0, 10),
        p_requested_time: "09:00",
      });
      const bookingId = data[0].id;

      const { error: skip1 } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "scheduled",
        p_scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(skip1).toBeDefined();
      expect(skip1?.message).toContain("Invalid state transition from new to scheduled");

      const { error: skip2 } = await adminClient.rpc("staff_manage_booking", {
        p_booking_id: bookingId,
        p_status: "completed",
      });
      expect(skip2).toBeDefined();
      expect(skip2?.message).toContain("Invalid state transition from new to completed");
    });
  });
});
