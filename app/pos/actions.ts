"use server";

import {
  scopedClientOrError,
  type ProtectedReadResult,
} from "@/lib/supabase/scoped-client";
import {
  listProductsForPOS,
  completePOSSale,
  type POSProduct,
  type CheckoutPayload,
  type CompletedSaleResult,
} from "@/lib/supabase/pos";

const ALLOWED_POS_ROLES = new Set(["cashier", "manager", "admin"]);

/**
 * Loads products for the POS terminal using the caller's scoped session token.
 * Reads through products_cashier view (hiding cost_price and margin).
 */
export async function handleLoadPOSProducts(
  accessToken: string
): Promise<ProtectedReadResult<POSProduct[]>> {
  const gate = await scopedClientOrError(accessToken);
  if ("error" in gate) {
    return { ok: false, kind: "unauthorized", message: gate.error };
  }

  if (!gate.role || !ALLOWED_POS_ROLES.has(gate.role)) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "POS workspace requires a staff role (Cashier, Manager, or Admin).",
    };
  }

  return listProductsForPOS(gate.scoped);
}

/**
 * Completes an atomic in-shop sale via server RPC.
 * Price, totals, stock deduction, and inventory movements are determined authoritatively by the database.
 */
export async function handleCheckout(
  accessToken: string,
  payload: CheckoutPayload
): Promise<CompletedSaleResult> {
  const gate = await scopedClientOrError(accessToken);
  if ("error" in gate) {
    return { ok: false, error: gate.error };
  }

  if (!gate.role || !ALLOWED_POS_ROLES.has(gate.role)) {
    return {
      ok: false,
      error: "POS checkout requires an active staff session (Cashier, Manager, or Admin).",
    };
  }

  return completePOSSale(gate.scoped, payload);
}
