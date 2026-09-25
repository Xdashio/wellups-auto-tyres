import { publicSupabase } from "./catalog";

export interface PaymentRecord {
  id: string;
  payment_number: string;
  amount: number;
  currency: string;
  payment_channel: string;
  status: string;
  provider_reference?: string | null;
  payer_phone?: string | null;
  payer_name?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export async function customerSubmitPayment(params: {
  quoteId: string;
  token: string;
  providerReference: string;
  payerPhone?: string;
  payerName?: string;
  paymentChannel?: string;
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  const { data, error } = await publicSupabase.rpc("customer_submit_payment", {
    p_quote_token: params.token,
    p_provider_reference: params.providerReference,
    p_payer_phone: params.payerPhone || null,
    p_payer_name: params.payerName || null,
    p_payment_channel: params.paymentChannel || "mpesa",
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, paymentId: data as string };
}

export async function customerGetQuotePayments(quoteId: string, token: string): Promise<PaymentRecord[]> {
  const { data, error } = await publicSupabase.rpc("customer_get_quote_payments", {
    p_quote_token: token,
  });
  if (error) {
    console.error("Error fetching payments:", error);
    return [];
  }
  return (data || []) as PaymentRecord[];
}
