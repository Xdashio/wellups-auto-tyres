import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Staff roster management (migration 017). No service_role key exists in
// app code by design, so everything here goes through the admin-only
// SECURITY DEFINER RPCs, which enforce the admin role from the caller's
// JWT and fail closed (42501) for anyone else. Roles themselves are still
// derived by app.custom_access_token_hook from app.staff_users — this
// module never writes app_metadata directly.

export const StaffRoleSchema = z.enum(["admin", "manager", "cashier"]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const StaffInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Email is required")
    .max(254, "Email is too long")
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address"),
  role: StaffRoleSchema,
  displayName: z
    .string()
    .trim()
    .max(200, "Display name is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type StaffInviteInput = z.infer<typeof StaffInviteSchema>;

export interface StaffRosterEntry {
  staff_id: string | null;
  auth_user_id: string | null;
  email: string;
  role: StaffRole;
  display_name: string | null;
  status: "active" | "invited";
  created_at: string;
  invite_id: string | null;
}

export type StaffActionResult = { success: boolean; error?: string };

function rpcErrorMessage(error: { message: string }): string {
  return error.message;
}

export async function listStaffForAdmin(
  client: SupabaseClient
): Promise<StaffRosterEntry[]> {
  const { data, error } = await client.rpc("admin_list_staff");
  if (error) {
    console.error("Error listing staff:", error);
    return [];
  }
  return (data ?? []) as StaffRosterEntry[];
}

export async function inviteStaff(
  client: SupabaseClient,
  input: StaffInviteInput
): Promise<StaffActionResult> {
  const validation = StaffInviteSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues.map((i) => i.message).join(", "),
    };
  }
  const { error } = await client.rpc("admin_invite_staff", {
    p_email: validation.data.email,
    p_role: validation.data.role,
    p_display_name: validation.data.displayName ?? null,
  });
  if (error) return { success: false, error: rpcErrorMessage(error) };
  return { success: true };
}

export async function revokeStaffInvite(
  client: SupabaseClient,
  inviteId: string
): Promise<StaffActionResult> {
  if (!inviteId) return { success: false, error: "Invite id is required." };
  const { error } = await client.rpc("admin_revoke_invite", {
    p_invite_id: inviteId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error) };
  return { success: true };
}

export async function setStaffRole(
  client: SupabaseClient,
  staffId: string,
  role: StaffRole
): Promise<StaffActionResult> {
  if (!staffId) return { success: false, error: "Staff id is required." };
  const roleCheck = StaffRoleSchema.safeParse(role);
  if (!roleCheck.success) {
    return { success: false, error: "Role must be admin, manager, or cashier." };
  }
  const { error } = await client.rpc("admin_set_staff_role", {
    p_staff_id: staffId,
    p_role: roleCheck.data,
  });
  if (error) return { success: false, error: rpcErrorMessage(error) };
  return { success: true };
}

export async function removeStaff(
  client: SupabaseClient,
  staffId: string
): Promise<StaffActionResult> {
  if (!staffId) return { success: false, error: "Staff id is required." };
  const { error } = await client.rpc("admin_remove_staff", {
    p_staff_id: staffId,
  });
  if (error) return { success: false, error: rpcErrorMessage(error) };
  return { success: true };
}
