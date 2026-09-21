import { z } from "zod";
import { publicSupabase } from "./catalog";

export type BookingStatus =
  | "new"
  | "under_review"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "declined";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createBookingSchema = z.object({
  serviceId: z.string().regex(uuidRegex, "Invalid service ID"),
  customerName: z.string().trim().min(1, "Customer name is required").max(100, "Name is too long"),
  customerPhone: z.string().trim().min(5, "Customer phone number is required").max(30, "Phone number is too long"),
  customerEmail: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal(""))
    .nullable(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Requested date must be in YYYY-MM-DD format"),
  requestedTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Requested time must be in 24-hour HH:MM format (e.g. 09:30, 14:00)"),
  vehicleFitmentId: z.string().regex(uuidRegex, "Invalid vehicle fitment ID").optional().or(z.literal("")).nullable(),
  vehicleSummary: z.string().trim().max(200, "Vehicle summary too long").optional().or(z.literal("")).nullable(),
  customerNotes: z.string().trim().max(1000, "Customer notes too long").optional().or(z.literal("")).nullable(),
});

export const staffBookingActionSchema = z.object({
  bookingId: z.string().regex(uuidRegex, "Invalid booking ID"),
  status: z.enum(["new", "under_review", "scheduled", "completed", "cancelled", "declined"]),
  scheduledAt: z.string().optional().nullable(),
  staffNotes: z.string().max(2000, "Staff notes too long").optional().nullable(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type StaffBookingActionInput = z.infer<typeof staffBookingActionSchema>;

export interface BookingCustomer {
  id: string;
  booking_number: string;
  branch_id?: string;
  service_id: string;
  service_name: string | null;
  requested_date: string;
  requested_time: string;
  vehicle_summary: string | null;
  customer_notes: string | null;
  status: BookingStatus;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  customer_id?: string | null;
}

export interface BookingStaff {
  id: string;
  booking_number: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_id: string;
  service_name: string | null;
  requested_date: string;
  requested_time: string;
  vehicle_summary: string | null;
  customer_notes: string | null;
  status: BookingStatus;
  scheduled_at: string | null;
  staff_notes: string | null;
  handled_by: string | null;
  responded_at: string | null;
  secret_token: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  bookingNumber?: string;
  secretToken?: string;
  error?: string;
}

export interface StaffBookingActionResult {
  success: boolean;
  error?: string;
}

/**
 * Creates a persistent service booking request via public.create_service_booking RPC.
 * Never accepts branchId from client (derived server-side in RPC).
 */
export async function createServiceBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const valid = parsed.data;

  // Validate that requestedDate is not in the past (client pre-check)
  const todayStr = new Date().toISOString().slice(0, 10);
  if (valid.requestedDate < todayStr) {
    return { success: false, error: "Requested date cannot be in the past" };
  }

  const { data, error } = await publicSupabase.rpc("create_service_booking", {
    p_service_id: valid.serviceId,
    p_customer_name: valid.customerName,
    p_customer_phone: valid.customerPhone,
    p_customer_email: valid.customerEmail?.trim() || null,
    p_requested_date: valid.requestedDate,
    p_requested_time: valid.requestedTime,
    p_vehicle_fitment_id: valid.vehicleFitmentId || null,
    p_vehicle_summary: valid.vehicleSummary?.trim() || null,
    p_customer_notes: valid.customerNotes?.trim() || null,
  });

  if (error || !data || data.length === 0) {
    console.error("Error creating service booking:", error);
    return { success: false, error: error?.message || "Failed to submit booking request" };
  }

  const row = data[0];
  return {
    success: true,
    bookingId: row.id,
    bookingNumber: row.booking_number,
    secretToken: row.secret_token,
  };
}

/**
 * Fetches a guest booking by ID and Secret Token via public.get_guest_booking RPC.
 * Never exposes secret_token, staff_notes, or staff handler identities.
 */
export async function getGuestBooking(
  bookingId: string,
  secretToken: string
): Promise<BookingCustomer | null> {
  if (!bookingId || !secretToken) return null;

  const { data, error } = await publicSupabase.rpc("get_guest_booking", {
    p_booking_id: bookingId,
    p_token: secretToken,
  });

  if (error || !data || data.length === 0) {
    if (error) console.error("Error fetching guest booking:", error);
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    booking_number: row.booking_number,
    service_id: row.service_id,
    service_name: row.service_name,
    requested_date: row.requested_date,
    requested_time: row.requested_time,
    vehicle_summary: row.vehicle_summary,
    customer_notes: row.customer_notes,
    status: row.status,
    scheduled_at: row.scheduled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fetches booking queue for staff operations via public.service_bookings_staff view.
 * Exclusively queries typed view with filter parameters.
 */
export async function getStaffBookingQueue(params?: {
  status?: BookingStatus;
  search?: string;
  date?: string;
}): Promise<BookingStaff[]> {
  let query = publicSupabase
    .from("service_bookings_staff")
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (params?.date) {
    query = query.eq("requested_date", params.date);
  }
  if (params?.search) {
    const term = params.search.trim();
    query = query.or(
      `booking_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching staff booking queue:", error);
    return [];
  }

  return (data || []) as BookingStaff[];
}

/**
 * Manages booking status and scheduling via authoritative public.staff_manage_booking RPC.
 */
export async function manageStaffBooking(
  input: StaffBookingActionInput
): Promise<StaffBookingActionResult> {
  const parsed = staffBookingActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { error } = await publicSupabase.rpc("staff_manage_booking", {
    p_booking_id: input.bookingId,
    p_status: input.status,
    p_scheduled_at: input.scheduledAt || null,
    p_staff_notes: input.staffNotes || null,
  });

  if (error) {
    console.error("Error in staff_manage_booking:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
