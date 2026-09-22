import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Builds a Supabase client that acts as the signed-in staff member whose
// access token the browser holds. Server Actions run without a user session,
// so the caller's token must be passed explicitly from client components;
// PostgREST/RLS then enforces the REAL actor (admin/manager/cashier/anon)
// instead of every action running as anonymous. Returns null when no token
// was supplied so actions can reject unauthenticated callers server-side.
// The anon key is still used — no service_role anywhere in app code.
export function clientWithAccessToken(accessToken: string | null | undefined): SupabaseClient | null {
  if (!accessToken) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase configuration is missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Validates the caller's token against the Auth server and returns the user
// id + role claim. Rejects forged/expired tokens server-side before any
// mutation. RLS remains the authoritative boundary; this is defense-in-depth.
export async function verifiedStaffActor(
  client: SupabaseClient
): Promise<{ userId: string; role: string | null } | { error: string }> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { error: "Not authenticated. Sign in as a staff member first." };
  }
  const role =
    typeof data.user.app_metadata?.user_role === "string"
      ? (data.user.app_metadata.user_role as string)
      : null;
  return { userId: data.user.id, role };
}
