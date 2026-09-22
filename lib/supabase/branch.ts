import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const BranchSettingsSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  mpesa_channel_type: z.enum(["paybill", "till"]).nullable().optional(),
  mpesa_paybill_number: z.string().nullable().optional(),
  mpesa_till_number: z.string().nullable().optional(),
  mpesa_account_number: z.string().nullable().optional(),
});

export type BranchSettingsInput = z.infer<typeof BranchSettingsSchema>;

export interface BranchData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: string | null;
  mpesa_channel_type: "paybill" | "till" | null;
  mpesa_paybill_number: string | null;
  mpesa_till_number: string | null;
  mpesa_account_number: string | null;
}

export async function getBranchForAdmin(client: SupabaseClient): Promise<BranchData | null> {
  const { data, error } = await client
    .from("branches_admin")
    .select(
      "id, name, address, phone, whatsapp, opening_hours, mpesa_channel_type, mpesa_paybill_number, mpesa_till_number, mpesa_account_number"
    )
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching branch for admin:", error);
    return null;
  }
  return data;
}

export async function updateBranchSettings(
  client: SupabaseClient,
  branchId: string,
  input: BranchSettingsInput
): Promise<{ success: boolean; error?: string; data?: BranchData }> {
  // Validate input with Zod
  const validation = BranchSettingsSchema.safeParse(input);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const validatedData = validation.data;

  const { data, error } = await client
    .from("branches")
    .update({
      name: validatedData.name,
      address: validatedData.address || null,
      phone: validatedData.phone || null,
      whatsapp: validatedData.whatsapp || null,
      opening_hours: validatedData.opening_hours || null,
      mpesa_channel_type: validatedData.mpesa_channel_type || null,
      mpesa_paybill_number: validatedData.mpesa_paybill_number || null,
      mpesa_till_number: validatedData.mpesa_till_number || null,
      mpesa_account_number: validatedData.mpesa_account_number || null,
    })
    .eq("id", branchId)
    .select(
      "id, name, address, phone, whatsapp, opening_hours, mpesa_channel_type, mpesa_paybill_number, mpesa_till_number, mpesa_account_number"
    )
    .single();

  if (error) {
    console.error("Error updating branch settings:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
