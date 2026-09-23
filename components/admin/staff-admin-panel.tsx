"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  StaffInviteSchema,
  type StaffRosterEntry,
  type StaffRole,
} from "@/lib/supabase/staff-admin";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type ActionResult = { success: boolean; error?: string };

interface StaffAdminPanelProps {
  // GATE 023 (S1): the roster arrives through this token-scoped action
  // instead of an anon server-render prop, so a non-admin caller gets an
  // explicit denied state rather than a false "No staff yet" table.
  onLoad: (accessToken: string) => Promise<ProtectedReadResult<StaffRosterEntry[]>>;
  onInvite: (accessToken: string, email: string, role: StaffRole, displayName?: string) => Promise<ActionResult>;
  onRevokeInvite: (accessToken: string, inviteId: string) => Promise<ActionResult>;
  onSetRole: (accessToken: string, staffId: string, role: StaffRole) => Promise<ActionResult>;
  onRemove: (accessToken: string, staffId: string) => Promise<ActionResult>;
}

const ROLE_OPTIONS: StaffRole[] = ["admin", "manager", "cashier"];

export function StaffAdminPanel({
  onLoad,
  onInvite,
  onRevokeInvite,
  onSetRole,
  onRemove,
}: StaffAdminPanelProps) {
  const read = useProtectedRead(onLoad);
  const [roster, setRoster] = useState<StaffRosterEntry[]>([]);
  useEffect(() => {
    if (read.status === "ready") setRoster(read.data);
  }, [read]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const refreshNote = (action: string, res: ActionResult) => {
    if (!res.success) {
      setNotice(null);
      setFormError(res.error || `${action} failed.`);
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = StaffInviteSchema.safeParse({ email, role, displayName });
    if (!validation.success) {
      setFormError(validation.error.issues.map((i) => i.message).join(", "));
      return;
    }
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setFormError("Sign in as an Admin before inviting staff.");
        return;
      }
      const res = await onInvite(accessToken, validation.data.email, validation.data.role, validation.data.displayName);
      if (!refreshNote("Invite", res)) return;
      setNotice(
        `Pending grant recorded for ${validation.data.email}. It becomes an active role on their next sign-in after their account exists (create it via Supabase Dashboard → Authentication → Add user if needed).`
      );
      setEmail("");
      setDisplayName("");
      setRole("cashier");
      setRoster((prev) => [
        ...prev,
        {
          staff_id: null,
          auth_user_id: null,
          email: validation.data.email,
          role: validation.data.role,
          display_name: validation.data.displayName ?? null,
          status: "invited",
          created_at: new Date().toISOString(),
          invite_id: null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (entry: StaffRosterEntry) => {
    if (!entry.invite_id) return;
    if (!confirm(`Withdraw the pending invite for ${entry.email}?`)) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormError("Sign in as an Admin first.");
      return;
    }
    const res = await onRevokeInvite(accessToken, entry.invite_id);
    if (!refreshNote("Revoke", res)) return;
    setRoster((prev) => prev.filter((r) => r.invite_id !== entry.invite_id));
    setNotice(`Pending invite for ${entry.email} withdrawn.`);
  };

  const handleSetRole = async (entry: StaffRosterEntry, next: StaffRole) => {
    if (!entry.staff_id || entry.role === next) return;
    if (!confirm(`Change ${entry.email} from ${entry.role} to ${next}?`)) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormError("Sign in as an Admin first.");
      return;
    }
    const res = await onSetRole(accessToken, entry.staff_id, next);
    if (!refreshNote("Role change", res)) return;
    setRoster((prev) => prev.map((r) => (r.staff_id === entry.staff_id ? { ...r, role: next } : r)));
    setNotice(`Role for ${entry.email} is now ${next}. It applies on their next sign-in (token refresh).`);
  };

  const handleRemove = async (entry: StaffRosterEntry) => {
    if (!entry.staff_id) return;
    if (
      !confirm(
        `Deactivate ${entry.email}? Their role mapping is deleted immediately; the claim drops out on their next sign-in. Their current session is NOT revoked here — ban them via the Supabase Dashboard for urgent cases.`
      )
    ) {
      return;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormError("Sign in as an Admin first.");
      return;
    }
    const res = await onRemove(accessToken, entry.staff_id);
    if (!refreshNote("Deactivation", res)) return;
    setRoster((prev) => prev.filter((r) => r.staff_id !== entry.staff_id));
    setNotice(`${entry.email} deactivated. Remember: ban via Dashboard → Authentication for immediate session revocation if needed.`);
  };

  // Distinct read outcomes (GATE 023 S1): the grant form and roster table
  // render only for a signed-in Admin whose admin_list_staff read
  // succeeded. Manager/Cashier and anon get the explicit denied state —
  // Admin-only administration is preserved, and an empty roster now always
  // means zero staff records, never a swallowed RPC failure.
  if (read.status === "loading") {
    return (
      <div data-testid="staff-loading" className="text-center py-16">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-2">Loading staff roster...</p>
      </div>
    );
  }
  if (read.status === "unauthorized") {
    return (
      <div
        data-testid="staff-unauthorized"
        className="text-center py-12 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2"
      >
        <p className="text-lg font-semibold text-destructive">
          Could not read staff roster — access denied.
        </p>
        <p className="text-sm text-text-secondary">{read.message}</p>
      </div>
    );
  }
  if (read.status === "error") {
    return (
      <div
        data-testid="staff-error"
        className="text-center py-12 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2"
      >
        <p className="text-lg font-semibold text-destructive">
          Could not read staff roster — unexpected database error.
        </p>
        <p className="text-sm text-text-secondary">{read.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-2 text-sm">
        <h2 className="font-bold">How staff access works here</h2>
        <ul className="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            Accounts themselves are created manually in the Supabase Dashboard
            (Authentication → Add user) — this screen cannot send invites yet.
          </li>
          <li>
            Add the person&apos;s email + role below <em>before or after</em> their
            account exists: the grant attaches automatically on their next sign-in.
          </li>
          <li>
            Role changes and deactivations apply on next sign-in. Live sessions
            are never revoked from here — urgent cases need a Dashboard ban.
          </li>
          <li>
            Safety rails are enforced server-side: the last admin can never be
            demoted or removed, and you cannot remove your own record.
          </li>
        </ul>
      </Card>

      {formError && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {formError}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-md bg-success/10 border border-success/20 text-sm">
          {notice}
        </div>
      )}

      <Card className="p-5 space-y-3">
        <h2 className="font-bold">Grant a role (pending invite)</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <label className="text-xs text-text-secondary">Email</label>
            <Input
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Role</label>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40 flex-1">
            <label className="text-xs text-text-secondary">Display name (optional)</label>
            <Input
              placeholder="e.g. Jane Wanjiru"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Add Grant"}
          </Button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  data-testid="staff-empty"
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  No staff yet — add the first grant above.
                </td>
              </tr>
            )}
            {roster.map((r, i) => (
              <tr key={r.staff_id ?? r.invite_id ?? `${r.email}-${i}`} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{r.email}</td>
                <td className="px-4 py-3">
                  {r.status === "active" && r.staff_id ? (
                    <Select value={r.role} onValueChange={(v) => handleSetRole(r, v as StaffRole)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge tone="warning">{r.role} (pending)</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.status === "active" ? "success" : "warning"}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "invited" ? (
                    <Button variant="secondary" onClick={() => handleRevoke(r)}>
                      Withdraw
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={() => handleRemove(r)}>
                      Deactivate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
