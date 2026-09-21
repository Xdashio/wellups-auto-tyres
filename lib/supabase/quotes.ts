import { publicSupabase } from "./catalog";

export type QuoteItemType = "product" | "service" | "custom";
export type QuoteStatus = "new" | "under_review" | "quoted" | "accepted" | "declined" | "expired";

export interface CreateQuoteRequestInput {
  branchId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  itemType: QuoteItemType;
  productId?: string;
  serviceId?: string;
  vehicleFitmentId?: string;
  vehicleSummary?: string;
  quantity?: number;
  customerNotes?: string;
}

export interface QuoteRequestCustomer {
  id: string;
  quote_number: string;
  item_type: QuoteItemType;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_brand: string | null;
  product_size_spec: string | null;
  service_id: string | null;
  service_name: string | null;
  vehicle_summary: string | null;
  quantity: number;
  customer_notes: string | null;
  status: QuoteStatus;
  offered_price: number | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteRequestStaff {
  id: string;
  quote_number: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  item_type: QuoteItemType;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_brand: string | null;
  product_size_spec: string | null;
  service_id: string | null;
  service_name: string | null;
  vehicle_summary: string | null;
  quantity: number;
  customer_notes: string | null;
  status: QuoteStatus;
  offered_price: number | null;
  valid_until: string | null;
  staff_notes: string | null;
  responded_by: string | null;
  responded_at: string | null;
  secret_token: string;
  created_at: string;
  updated_at: string;
}

export interface StaffQuoteResponseInput {
  quoteId: string;
  status: QuoteStatus;
  offeredPrice?: number;
  validUntil?: string;
  staffNotes?: string;
}

/**
 * Creates a persistent Quote Request record in Supabase database.
 */
export async function createQuoteRequest(input: CreateQuoteRequestInput): Promise<{
  success: boolean;
  quoteId?: string;
  quoteNumber?: string;
  secretToken?: string;
  error?: string;
}> {
  if (!input.customerName || !input.customerName.trim()) {
    return { success: false, error: "Customer name is required." };
  }
  if (!input.customerPhone || !input.customerPhone.trim()) {
    return { success: false, error: "Customer phone number is required." };
  }

  // Get primary branch ID if not explicitly provided
  let branchId = input.branchId;
  if (!branchId) {
    const { data: branchData } = await publicSupabase.from("branches_public").select("id").limit(1).single();
    if (branchData) {
      branchId = branchData.id;
    }
  }

  if (!branchId) {
    return { success: false, error: "Branch configuration error. Please try again." };
  }

  const payload = {
    branch_id: branchId,
    customer_name: input.customerName.trim(),
    customer_phone: input.customerPhone.trim(),
    customer_email: input.customerEmail?.trim() || null,
    item_type: input.itemType,
    product_id: input.productId || null,
    service_id: input.serviceId || null,
    vehicle_fitment_id: input.vehicleFitmentId || null,
    vehicle_summary: input.vehicleSummary?.trim() || null,
    quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    customer_notes: input.customerNotes?.trim() || null
  };

  const { data, error } = await publicSupabase
    .from("quote_requests")
    .insert(payload)
    .select("id, quote_number, secret_token")
    .single();

  if (error) {
    console.error("Error creating quote request:", error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    quoteId: data.id,
    quoteNumber: data.quote_number,
    secretToken: data.secret_token
  };
}

/**
 * Fetches a guest quote by ID and Secret Token via RPC function.
 */
export async function getGuestQuote(quoteId: string, secretToken: string): Promise<QuoteRequestCustomer | null> {
  const { data, error } = await publicSupabase.rpc("get_guest_quote", {
    p_quote_id: quoteId,
    p_token: secretToken
  });

  if (error || !data || data.length === 0) {
    if (error) console.error("Error fetching guest quote:", error);
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    quote_number: row.quote_number,
    item_type: row.item_type,
    product_id: null,
    product_name: row.product_name,
    product_sku: null,
    product_brand: null,
    product_size_spec: null,
    service_id: null,
    service_name: row.service_name,
    vehicle_summary: row.vehicle_summary,
    quantity: row.quantity,
    customer_notes: row.customer_notes,
    status: row.status,
    offered_price: row.offered_price ? Number(row.offered_price) : null,
    valid_until: row.valid_until,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Fetches quote requests for staff queue in /admin/quotes.
 */
export async function getStaffQuoteQueue(params?: {
  status?: QuoteStatus;
  search?: string;
}): Promise<QuoteRequestStaff[]> {
  let query = publicSupabase.from("quote_requests_staff").select("*").order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (params?.search) {
    query = query.or(
      `quote_number.ilike.%${params.search}%,customer_name.ilike.%${params.search}%,customer_phone.ilike.%${params.search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching staff quote queue:", error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row,
    offered_price: row.offered_price ? Number(row.offered_price) : null
  }));
}

/**
 * Updates staff quote response (pricing, status, notes).
 */
export async function updateStaffQuoteResponse(input: StaffQuoteResponseInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const updatePayload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString()
  };

  if (input.offeredPrice !== undefined) {
    updatePayload.offered_price = input.offeredPrice;
  }
  if (input.validUntil !== undefined) {
    updatePayload.valid_until = input.validUntil;
  }
  if (input.staffNotes !== undefined) {
    updatePayload.staff_notes = input.staffNotes;
  }
  if (input.status === "quoted") {
    updatePayload.responded_at = new Date().toISOString();
  }

  const { error } = await publicSupabase
    .from("quote_requests")
    .update(updatePayload)
    .eq("id", input.quoteId);

  if (error) {
    console.error("Error updating staff quote response:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Updates customer quote status (accept/decline).
 */
export async function updateCustomerQuoteStatus(
  quoteId: string,
  status: "accepted" | "declined"
): Promise<{ success: boolean; error?: string }> {
  const { error } = await publicSupabase
    .from("quote_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  if (error) {
    console.error("Error updating customer quote status:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Helper to check if a quote expiration timestamp has passed.
 */
export function isQuoteExpired(validUntil: string | null | undefined): boolean {
  if (!validUntil) return false;
  return new Date(validUntil).getTime() < Date.now();
}
