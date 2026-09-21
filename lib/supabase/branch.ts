import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const BranchSettingsSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
});

export type BranchSettingsInput = z.infer<typeof BranchSettingsSchema>;

export interface BranchData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: string | null;
}

export async function getBranchForAdmin(client: SupabaseClient): Promise<BranchData | null> {
  const { data, error } = await client
    .from("branches_public")
    .select("id, name, address, phone, whatsapp, opening_hours")
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
    })
    .eq("id", branchId)
    .select("id, name, address, phone, whatsapp, opening_hours")
    .single();

  if (error) {
    console.error("Error updating branch settings:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
