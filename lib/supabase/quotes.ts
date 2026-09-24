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
  accepted_at?: string | null;
}

export interface QuoteAcceptance {
  id: string;
  quote_id: string;
  quote_number: string;
  offered_price: number;
  currency: string;
  item_type: QuoteItemType;
  item_name: string;
  product_id?: string | null;
  service_id?: string | null;
  quantity: number;
  vehicle_fitment_id?: string | null;
  vehicle_summary: string | null;
  customer_notes: string | null;
  valid_until: string;
  accepted_at: string;
  acceptance_mechanism: "guest_token" | "authenticated_user";
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  token_fingerprint: string;
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
 * Creates a persistent Quote Request record via public RPC function.
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

  const { data, error } = await publicSupabase.rpc("create_quote_request", {
    p_branch_id: branchId,
    p_customer_name: input.customerName.trim(),
    p_customer_phone: input.customerPhone.trim(),
    p_customer_email: input.customerEmail?.trim() || null,
    p_item_type: input.itemType,
    p_product_id: input.productId || null,
    p_service_id: input.serviceId || null,
    p_vehicle_fitment_id: input.vehicleFitmentId || null,
    p_vehicle_summary: input.vehicleSummary?.trim() || null,
    p_quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    p_customer_notes: input.customerNotes?.trim() || null
  });

  if (error || !data || data.length === 0) {
    console.error("Error creating quote request:", error);
    return { success: false, error: error?.message || "Failed to create quote request" };
  }

  const row = data[0];
  return {
    success: true,
    quoteId: row.id,
    quoteNumber: row.quote_number,
    secretToken: row.secret_token
  };
}

/**
 * Fetches a guest quote by ID and Secret Token via public RPC function.
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
    updated_at: row.updated_at,
    accepted_at: row.accepted_at || null
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
 * Updates staff quote response via staff_respond_to_quote RPC (Admin & Manager ONLY).
 */
export async function updateStaffQuoteResponse(input: StaffQuoteResponseInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const { error } = await publicSupabase.rpc("staff_respond_to_quote", {
    p_quote_id: input.quoteId,
    p_status: input.status,
    p_offered_price: input.offeredPrice || null,
    p_valid_until: input.validUntil || null,
    p_staff_notes: input.staffNotes || null
  });

  if (error) {
    console.error("Error updating staff quote response:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Updates customer quote status via customer_respond_to_quote RPC (accept/decline ONLY).
 */
export async function updateCustomerQuoteStatus(
  quoteId: string,
  status: "accepted" | "declined",
  secretToken?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await publicSupabase.rpc("customer_respond_to_quote", {
    p_quote_id: quoteId,
    p_action: status === "accepted" ? "accept" : "decline",
    p_token: secretToken || null
  });

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

/**
 * Fetches the immutable acceptance evidence record for a quote using the guest secret token.
 */
export async function getQuoteAcceptance(quoteId: string, secretToken: string): Promise<QuoteAcceptance | null> {
  const { data, error } = await publicSupabase.rpc("get_quote_acceptance", {
    p_quote_id: quoteId,
    p_token: secretToken
  });

  if (error || !data || data.length === 0) {
    if (error) console.error("Error fetching quote acceptance evidence:", error);
    return null;
  }

  const row = data[0];
  return {
    id: row.id,
    quote_id: row.quote_id,
    quote_number: row.quote_number,
    offered_price: Number(row.offered_price),
    currency: row.currency || "KES",
    item_type: row.item_type,
    item_name: row.item_name,
    product_id: null,
    service_id: null,
    quantity: row.quantity,
    vehicle_fitment_id: null,
    vehicle_summary: row.vehicle_summary,
    customer_notes: row.customer_notes,
    valid_until: row.valid_until,
    accepted_at: row.accepted_at,
    acceptance_mechanism: row.acceptance_mechanism,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    token_fingerprint: row.token_fingerprint
  };
}

/**
 * Generates the staff WhatsApp message URL containing the customer portal link.
 * Strictly adheres to the rule that WhatsApp is a notification channel only,
 * with the portal link acting as the gateway to the authoritative commercial system of record.
 */
export function getStaffWhatsAppQuoteUrl(params: {
  customerPhone: string;
  customerName: string;
  quoteNumber: string;
  quoteId: string;
  secretToken: string;
  itemName: string;
  quantity: number;
  offeredPrice?: number | string | null;
  validUntilDate?: string | null;
  origin?: string;
}): string | null {
  const cleanPhone = params.customerPhone.replace(/[^0-9]/g, "");
  if (!cleanPhone) return null;

  const priceText = params.offeredPrice
    ? `KES ${parseFloat(params.offeredPrice.toString()).toLocaleString()}`
    : "[Price Pending]";

  const baseUrl = params.origin || (typeof window !== "undefined" ? window.location.origin : "");
  const portalUrl = baseUrl
    ? `${baseUrl}/quotes/${params.quoteId}?token=${params.secretToken}`
    : `/quotes/${params.quoteId}?token=${params.secretToken}`;

  const text = encodeURIComponent(
    `Hello ${params.customerName},\n\n` +
    `Regarding your Quote Request ${params.quoteNumber} for ${params.itemName} (${params.quantity} unit/s):\n` +
    `Our offered price is ${priceText}${params.validUntilDate ? `, valid until ${params.validUntilDate}` : ""}.\n\n` +
    `Review details and respond securely on our customer portal:\n${portalUrl}\n\n` +
    `Thank you for choosing Well Lups Auto Tyres Limited.`
  );

  return `https://wa.me/${cleanPhone}?text=${text}`;
}

