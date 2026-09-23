"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";

// Client state for a token-scoped admin read (GATE 023, defect S1).
// Mirrors the established StaffAuthGate / quote-queue session pattern:
// the browser holds the staff session, obtains its access token, and passes
// it to a server action that queries the protected projection as that
// caller. Four states keep the three failure modes visually distinct:
//   loading       - session check / read in flight
//   unauthorized  - not signed in, or role not allowed on this projection
//   error         - unexpected database failure (never hidden)
//   ready         - authenticated + valid request + data (may be [])
// Re-runs on every auth-state change so sign-in, sign-out, and token
// refresh all drive a fresh read without polling.
export type ProtectedReadState<T> =
  | { status: "loading" }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const SIGNED_OUT_MESSAGE =
  "Not signed in. Sign in with a staff account that is allowed to view this data.";

export function useProtectedRead<T>(
  onLoad: (accessToken: string) => Promise<ProtectedReadResult<T>>
): ProtectedReadState<T> {
  const [state, setState] = useState<ProtectedReadState<T>>({ status: "loading" });
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    let cancelled = false;
    let runId = 0;

    const load = async () => {
      const myRun = ++runId;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      if (cancelled || myRun !== runId) return;
      if (!token) {
        // Anonymous visitor: no read is attempted at all. The protected
        // views would deny anon anyway (016 revokes); the honest state is
        // an access-denied panel, never an empty table or a false "Not
        // Found".
        setState({ status: "unauthorized", message: SIGNED_OUT_MESSAGE });
        return;
      }
      setState({ status: "loading" });
      try {
        const res = await onLoadRef.current(token);
        if (cancelled || myRun !== runId) return;
        if (res.ok) {
          setState({ status: "ready", data: res.data });
        } else {
          setState({ status: res.kind, message: res.message });
        }
      } catch (err) {
        if (cancelled || myRun !== runId) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unexpected client-side failure.",
        });
      }
    };

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
