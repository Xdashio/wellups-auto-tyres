import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// M-Pesa field hygiene (GATE 012 §8). No real business numbers are hardcoded;
// these validators only constrain SHAPE: trim, reject control characters,
// enforce channel-specific digit formats, preserve NULL when unconfigured.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function mpesaNumber(label: string) {
  return z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? null : t;
    })
    .refine((v) => v === null || !CONTROL_CHARS.test(v), {
      message: `${label} contains invalid characters`,
    })
    .refine((v) => v === null || /^[0-9]{5,7}$/.test(v), {
      message: `${label} must be 5-7 digits`,
    });
}

const mpesaAccount = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  })
  .refine((v) => v === null || !CONTROL_CHARS.test(v), {
    message: "M-Pesa account number contains invalid characters",
  })
  .refine((v) => v === null || /^[A-Za-z0-9 _.\-]{1,32}$/.test(v), {
    message: "M-Pesa account number is malformed",
  });

export const BranchSettingsSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters"),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  opening_hours: z.string().nullable().optional(),
  mpesa_channel_type: z.enum(["paybill", "till"]).nullable().optional(),
  mpesa_paybill_number: mpesaNumber("M-Pesa paybill number"),
  mpesa_till_number: mpesaNumber("M-Pesa till number"),
  mpesa_account_number: mpesaAccount,
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
  // Validate input with Zod (first line of defense; the RPC re-validates
  // server-side so browser input can never bypass format rules).
  const validation = BranchSettingsSchema.safeParse(input);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const validatedData = validation.data;

  // Writes go through the admin-only SECURITY DEFINER RPC — never a direct
  // table update. There is no public.branches relation; the previous
  // .from("branches") target did not exist. The RPC enforces the admin role
  // from the caller's JWT and returns the updated row as jsonb.
  const { data, error } = await client.rpc("admin_update_branch_settings", {
    p_branch_id: branchId,
    p_name: validatedData.name,
    p_address: validatedData.address ?? null,
    p_phone: validatedData.phone ?? null,
    p_whatsapp: validatedData.whatsapp ?? null,
    p_opening_hours: validatedData.opening_hours ?? null,
    p_mpesa_channel_type: validatedData.mpesa_channel_type ?? null,
    p_mpesa_paybill_number: validatedData.mpesa_paybill_number ?? null,
    p_mpesa_till_number: validatedData.mpesa_till_number ?? null,
    p_mpesa_account_number: validatedData.mpesa_account_number ?? null,
  });

  if (error) {
    console.error("Error updating branch settings:", error);
    return { success: false, error: error.message };
  }

  const row = data as Record<string, string | null> | null;
  if (!row || typeof row.id !== "string") {
    return { success: false, error: "Branch update returned no data." };
  }

  return {
    success: true,
    data: {
      id: row.id,
      name: (row.name as string) ?? "",
      address: (row.address as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      whatsapp: (row.whatsapp as string | null) ?? null,
      opening_hours: (row.opening_hours as string | null) ?? null,
      mpesa_channel_type: (row.mpesa_channel_type as "paybill" | "till" | null) ?? null,
      mpesa_paybill_number: (row.mpesa_paybill_number as string | null) ?? null,
      mpesa_till_number: (row.mpesa_till_number as string | null) ?? null,
      mpesa_account_number: (row.mpesa_account_number as string | null) ?? null,
    },
  };
}
