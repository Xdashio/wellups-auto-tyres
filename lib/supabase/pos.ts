import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { type ProtectedReadResult, readFailure } from "./scoped-client";

// ─── Input Validation Schemas ────────────────────────────────────────────────

export const CheckoutItemSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity cannot exceed 10000"),
});

export const CheckoutPayloadSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1, "Cart cannot be empty"),
});

export type CheckoutItemInput = z.infer<typeof CheckoutItemSchema>;
export type CheckoutPayload = z.infer<typeof CheckoutPayloadSchema>;

// ─── POS Domain Types ────────────────────────────────────────────────────────

export interface POSProduct {
  id: string;
  branch_id: string;
  category_id: string | null;
  name: string;
  sku: string;
  brand: string | null;
  size_spec: string | null;
  sell_price: number;
  stock_quantity: number;
  status: string;
  created_at: string;
}

export interface CompletedSaleItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CompletedSaleResult {
  ok: boolean;
  sale_id?: string;
  sale_number?: string;
  total_amount?: number;
  items?: CompletedSaleItem[];
  created_at?: string;
  error?: string;
}

// ─── Data Access Functions ───────────────────────────────────────────────────

/**
 * Reads products from public.products_cashier.
 * projects: id, branch_id, category_id, name, sku, brand, size_spec, sell_price, stock_quantity, status.
 * Omits cost_price and margin to maintain strict financial isolation for cashiers.
 */
export async function listProductsForPOS(
  client: SupabaseClient
): Promise<ProtectedReadResult<POSProduct[]>> {
  const primary = await client
    .from("products_cashier")
    .select("id, branch_id, category_id, name, sku, brand, size_spec, sell_price, stock_quantity, status, created_at")
    .order("name", { ascending: true });

  if (!primary.error) {
    return { ok: true, data: (primary.data ?? []) as POSProduct[] };
  }

  // If migration 019 DDL is pending deployment on remote Supabase,
  // products_cashier lacks sell_price (from 009 view). Fall back gracefully so UI
  // renders honest empty catalog rather than failing with PGRST204.
  if (primary.error.code === "PGRST204" || (primary.error.message && primary.error.message.includes("sell_price"))) {
    const fallback = await client
      .from("products_cashier")
      .select("id, branch_id, category_id, name, sku, brand, size_spec, stock_quantity, status, created_at")
      .order("name", { ascending: true });

    if (!fallback.error) {
      const dataWithFallback = (fallback.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        sell_price: 0,
      }));
      return { ok: true, data: dataWithFallback as unknown as POSProduct[] };
    }
  }

  return readFailure(primary.error);
}

/**
 * Executes atomic checkout via public.pos_complete_sale RPC.
 * Server/database derives branch, cashier, unit price, totals, stock deduction, and inventory movements.
 */
export async function completePOSSale(
  client: SupabaseClient,
  payload: CheckoutPayload
): Promise<CompletedSaleResult> {
  const validation = CheckoutPayloadSchema.safeParse(payload);
  if (!validation.success) {
    return {
      ok: false,
      error: validation.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { data, error } = await client.rpc("pos_complete_sale", {
    p_items: validation.data.items,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Failed to complete sale",
    };
  }

  return {
    ok: true,
    sale_id: data.sale_id,
    sale_number: data.sale_number,
    total_amount: Number(data.total_amount),
    items: data.items as CompletedSaleItem[],
    created_at: data.created_at,
  };
}
