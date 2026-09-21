import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PublicProduct {
  id: string;
  branch_id: string;
  category_id: string;
  name: string;
  sku: string;
  brand: string;
  size_spec: string;
  status: "active" | "in_stock" | "low_stock" | "out_of_stock";
  created_at: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  vehicle_types: string[];
  is_available: boolean;
}

export interface PublicVehicleFitment {
  fitment_id: string;
  make_id: string;
  make_name: string;
  model_id: string;
  model_name: string;
  trim_id: string;
  trim_name: string;
  year_start: number;
  year_end: number | null;
  tyre_size_spec: string;
  fitment_type: string;
  is_verified: boolean;
}

export type BadgeTone = "info" | "success" | "warning" | "error" | "neutral";

export function getQualitativeStockStatus(status: string): { label: string; tone: BadgeTone } {
  if (status === "out_of_stock") {
    return { label: "Out of Stock", tone: "error" };
  }
  if (status === "low_stock") {
    return { label: "Low Stock", tone: "warning" };
  }
  return { label: "In Stock", tone: "success" };
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: string | null;
}

export function getWhatsAppQuoteUrl(
  whatsappNumber: string | null | undefined,
  itemName: string,
  itemSku: string,
  sizeSpec?: string
): string | null {
  if (!whatsappNumber) {
    return null;
  }
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, "");
  if (!cleanNumber) {
    return null;
  }
  const text = encodeURIComponent(
    `Hello WELL LUPS AUTO TYRES, I would like to request a quote for:\n- Item: ${itemName}\n- SKU: ${itemSku}${sizeSpec ? `\n- Size Spec: ${sizeSpec}` : ""}`
  );
  return `https://wa.me/${cleanNumber}?text=${text}`;
}

export async function getPrimaryBranch(): Promise<PublicBranch | null> {
  const { data, error } = await publicSupabase
    .from("branches_public")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching primary branch:", error);
    return null;
  }
  return data;
}

export async function getPublicProducts(params?: {
  categoryId?: string;
  brand?: string;
  sizeSpec?: string;
  search?: string;
}): Promise<PublicProduct[]> {
  let query = publicSupabase.from("products_public").select("*").order("name", { ascending: true });

  if (params?.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params?.brand) {
    query = query.eq("brand", params.brand);
  }
  if (params?.sizeSpec) {
    query = query.eq("size_spec", params.sizeSpec);
  }
  if (params?.search) {
    query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%,brand.ilike.%${params.search}%,size_spec.ilike.%${params.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching public products:", error);
    return [];
  }
  return data || [];
}

export async function getPublicProductById(id: string): Promise<PublicProduct | null> {
  const { data, error } = await publicSupabase.from("products_public").select("*").eq("id", id).single();
  if (error) {
    console.error("Error fetching public product by ID:", error);
    return null;
  }
  return data;
}

export async function getPublicCategories(): Promise<PublicCategory[]> {
  const { data, error } = await publicSupabase.from("categories_public").select("*").order("name", { ascending: true });
  if (error) {
    console.error("Error fetching public categories:", error);
    return [];
  }
  return data || [];
}

export async function getPublicServices(): Promise<PublicService[]> {
  const { data, error } = await publicSupabase.from("services_public").select("*").order("name", { ascending: true });
  if (error) {
    console.error("Error fetching public services:", error);
    return [];
  }
  return data || [];
}

export async function getPublicServiceById(id: string): Promise<PublicService | null> {
  const { data, error } = await publicSupabase.from("services_public").select("*").eq("id", id).single();
  if (error) {
    console.error("Error fetching public service by ID:", error);
    return null;
  }
  return data;
}

export async function getPublicVehicleFitments(): Promise<PublicVehicleFitment[]> {
  const { data, error } = await publicSupabase.from("vehicle_fitments_public").select("*").order("make_name", { ascending: true });
  if (error) {
    console.error("Error fetching vehicle fitments:", error);
    return [];
  }
  return data || [];
}
