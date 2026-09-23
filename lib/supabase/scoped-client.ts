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

// ─── Protected read results (GATE 023, defect S1) ─────────────────────
// Admin projection reads must distinguish three outcomes instead of
// collapsing failures into [] / null (docs/CODE_STANDARDS.md §4: no
// silent failures):
//   ok:true                  -> authenticated + valid request + data
//                                (the array may genuinely be [])
//   ok:false kind=unauthorized -> caller unauthenticated or role not
//                                allowed on this projection
//   ok:false kind=error       -> unexpected database failure
// Authorization decisions still come from Postgres (RLS/views/RPCs);
// this type only makes the app report them honestly.
export type ProtectedReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "unauthorized"; message: string }
  | { ok: false; kind: "error"; message: string };

// Privilege/identity failures raised by PostgREST or the SECURITY DEFINER
// RPCs (42501/42503), invalid or expired JWTs, and HTTP-idiom codes. Any
// other code is an unexpected failure, not an authorization decision.
const UNAUTHORIZED_CODES = new Set([
  "42501",
  "42503",
  "401",
  "403",
  "PGRST301",
  "PGRST302",
]);

export function classifyReadError(
  error: { code?: string | null; message: string }
): "unauthorized" | "error" {
  if (error.code && UNAUTHORIZED_CODES.has(error.code)) return "unauthorized";
  // Message fallbacks for paths that lose the SQLSTATE (SECURITY DEFINER
  // RPCs phrase denials like "forbidden: admin only").
  if (/permission denied|not authorized|JWT expired|invalid claim|forbidden/i.test(error.message)) {
    return "unauthorized";
  }
  return "error";
}

export function readFailure(
  error: { code?: string | null; message: string }
): { ok: false; kind: "unauthorized" | "error"; message: string } {
  return { ok: false, kind: classifyReadError(error), message: error.message };
}

// One shared token gate for every admin page action, read and write: the
// browser passes its session access token, this validates it with the Auth
// server, and returns the signed-in actor's role claim. RLS and the RPC
// checks remain authoritative — this is defense-in-depth plus the role
// used to classify admin-only reads honestly (settings/staff/products/
// services reads return an explicit unauthorized result for non-admin
// roles instead of presenting the view's zero-row filter as an empty
// list). Six admin routes previously carried identical local copies of
// this helper; they all import it from here now (GATE 023 Phase 14).
export async function scopedClientOrError(
  accessToken: string
): Promise<{ scoped: SupabaseClient; userId: string; role: string | null } | { error: string }> {
  const scoped = clientWithAccessToken(accessToken);
  if (!scoped) return { error: "Not authenticated. Sign in as a staff member first." };
  const actor = await verifiedStaffActor(scoped);
  if ("error" in actor) return { error: actor.error };
  return { scoped, userId: actor.userId, role: actor.role };
}
