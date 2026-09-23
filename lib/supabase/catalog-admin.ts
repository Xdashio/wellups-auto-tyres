import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { type ProtectedReadResult, readFailure } from "./scoped-client";

// ─── Products ────────────────────────────────────────────────────────────

export const ProductInputSchema = z.object({
  branch_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  sku: z.string().min(1, "SKU is required"),
  brand: z.string().nullable().optional(),
  size_spec: z.string().nullable().optional(),
  cost_price: z.coerce.number().min(0, "Cost price must be 0 or more"),
  sell_price: z.coerce.number().min(0, "Sell price must be 0 or more"),
  stock_quantity: z.coerce.number().int().min(0, "Stock must be 0 or more"),
  status: z.enum(["active", "in_stock", "low_stock", "out_of_stock"]),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export interface AdminProduct extends ProductInput {
  id: string;
  margin: number;
  created_at: string;
}

// Admin projection reads (GATE 023, defect S1): typed results, never a
// swallowed failure. ok:true + [] means the signed-in caller genuinely
// sees zero records; a 42501/anon denial or an unexpected DB error is
// reported as such so the UI can distinguish "no products configured"
// from "could not read products".
export async function listProductsForAdmin(
  client: SupabaseClient
): Promise<ProtectedReadResult<AdminProduct[]>> {
  const { data, error } = await client
    .from("products_admin")
    .select("*")
    .order("name", { ascending: true });

  if (error) return readFailure(error);
  return { ok: true, data: (data ?? []) as AdminProduct[] };
}

export async function createProduct(
  client: SupabaseClient,
  input: ProductInput
): Promise<{ success: boolean; error?: string }> {
  const validation = ProductInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((i) => i.message).join(", ") };
  }
  const { error } = await client.from("products_admin").insert(validation.data);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateProduct(
  client: SupabaseClient,
  id: string,
  input: ProductInput
): Promise<{ success: boolean; error?: string }> {
  const validation = ProductInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((i) => i.message).join(", ") };
  }
  const { error } = await client.from("products_admin").update(validation.data).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteProduct(
  client: SupabaseClient,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await client.from("products_admin").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Services ────────────────────────────────────────────────────────────

export const ServiceInputSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().nullable().optional(),
  vehicle_types: z.array(z.string()).default([]),
  is_available: z.boolean().default(true),
});

export type ServiceInput = z.infer<typeof ServiceInputSchema>;

export interface AdminService extends ServiceInput {
  id: string;
  created_at: string;
}

export async function listServicesForAdmin(
  client: SupabaseClient
): Promise<ProtectedReadResult<AdminService[]>> {
  // services_public filters to is_available = true, which would hide
  // disabled services from admin and make them unreachable to re-enable —
  // use the unfiltered admin view instead.
  const { data, error } = await client
    .from("services_admin")
    .select("*")
    .order("name", { ascending: true });

  if (error) return readFailure(error);
  return { ok: true, data: (data ?? []) as AdminService[] };
}

export async function createService(
  client: SupabaseClient,
  input: ServiceInput
): Promise<{ success: boolean; error?: string }> {
  const validation = ServiceInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((i) => i.message).join(", ") };
  }
  const { error } = await client.from("services_admin").insert(validation.data);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateService(
  client: SupabaseClient,
  id: string,
  input: ServiceInput
): Promise<{ success: boolean; error?: string }> {
  const validation = ServiceInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues.map((i) => i.message).join(", ") };
  }
  const { error } = await client.from("services_admin").update(validation.data).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteService(
  client: SupabaseClient,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await client.from("services_admin").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Categories (shared taxonomy) ───────────────────────────────────────

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
}

export async function listCategoriesForAdmin(
  client: SupabaseClient
): Promise<ProtectedReadResult<AdminCategory[]>> {
  // Dedicated admin view (016): category writes must not ride the
  // anon-readable categories_public view.
  const { data, error } = await client
    .from("categories_admin")
    .select("*")
    .order("name", { ascending: true });

  if (error) return readFailure(error);
  return { ok: true, data: (data ?? []) as AdminCategory[] };
}

export async function createCategory(
  client: SupabaseClient,
  name: string,
  description?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!name || name.trim().length < 2) {
    return { success: false, error: "Category name must be at least 2 characters" };
  }
  const { error } = await client.from("categories_admin").insert({ name: name.trim(), description: description || null });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
