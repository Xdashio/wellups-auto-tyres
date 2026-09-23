"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Shared staff sign-in gate for admin pages (products / services / settings).
// Defense-in-depth UI layer only: the authoritative boundary is RLS (server
// actions run as the signed-in user via their access token). Shows who is
// signed in and blocks anonymous interaction until sign-in.
export function StaffAuthGate({ context }: { context: string }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        setUserRole(
          typeof user.app_metadata?.user_role === "string"
            ? (user.app_metadata.user_role as string)
            : null
        );
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        setUserRole(
          typeof session.user.app_metadata?.user_role === "string"
            ? (session.user.app_metadata.user_role as string)
            : null
        );
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (emailToUse?: string, passwordToUse?: string) => {
    setAuthLoading(true);
    setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse || loginEmail,
      password: passwordToUse || loginPassword,
    });
    setAuthLoading(false);
    if (error) {
      setLoginError(error.message);
    } else if (data.user) {
      setUserEmail(data.user.email ?? null);
      setUserRole(
        typeof data.user.app_metadata?.user_role === "string"
          ? (data.user.app_metadata.user_role as string)
          : null
      );
      setLoginEmail("");
      setLoginPassword("");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setUserRole(null);
  };

  if (userEmail) {
    return (
      <div
        data-testid="staff-session-bar"
        className="flex flex-wrap items-center justify-between gap-4 p-4 bg-navy/5 border border-navy/15 rounded-none"
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
            Staff Session:
          </span>
          <span data-testid="staff-email" className="font-mono text-sm font-semibold text-navy">
            {userEmail}
          </span>
          <Badge
            data-testid="staff-role"
            tone={userRole === "admin" ? "info" : "warning"}
          >
            ROLE: {(userRole || "NONE").toUpperCase()}
          </Badge>
          {userRole !== "admin" && (
            <span className="text-xs text-warning">
              Catalog and settings writes require the Admin role.
            </span>
          )}
        </div>
        <Button
          data-testid="staff-signout-btn"
          variant="ghost"
          onClick={handleSignOut}
          className="text-xs text-destructive hover:text-destructive/90 min-h-8 py-1 px-3"
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="staff-auth-panel"
      className="p-4 bg-blue-muted/10 border border-blue-muted/30 rounded-none space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-navy">Staff Authentication Required</h2>
          <p className="text-xs text-muted-foreground">{context}</p>
        </div>
        {process.env.NODE_ENV === "development" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="login-admin-quick"
              onClick={() => handleSignIn("admin@test.local", "TestPassword123!")}
              disabled={authLoading}
              className="px-2.5 py-1 text-xs font-semibold bg-navy text-white rounded-none hover:bg-navy/90 transition-colors"
            >
              Sign In as Admin
            </button>
            <button
              type="button"
              data-testid="login-manager-quick"
              onClick={() => handleSignIn("mgr@test.local", "TestPassword123!")}
              disabled={authLoading}
              className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-none hover:bg-primary/90 transition-colors"
            >
              Sign In as Manager
            </button>
            <button
              type="button"
              data-testid="login-cashier-quick"
              onClick={() => handleSignIn("cashier@test.local", "TestPassword123!")}
              disabled={authLoading}
              className="px-2.5 py-1 text-xs font-semibold bg-muted text-foreground rounded-none hover:bg-muted/80 transition-colors"
            >
              Sign In as Cashier
            </button>
          </div>
        )}
      </div>

      {loginError && (
        <div className="p-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-none">
          {loginError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        <label className="sr-only" htmlFor="staff-login-email">
          Staff email
        </label>
        <input
          id="staff-login-email"
          data-testid="staff-login-email"
          type="email"
          placeholder="Staff Email"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          className="px-3 py-1.5 text-xs border border-border rounded-none focus:outline-none focus:ring-1 focus:ring-primary w-48"
        />
        <label className="sr-only" htmlFor="staff-login-password">
          Password
        </label>
        <input
          id="staff-login-password"
          data-testid="staff-login-password"
          type="password"
          placeholder="Password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSignIn();
          }}
          className="px-3 py-1.5 text-xs border border-border rounded-none focus:outline-none focus:ring-1 focus:ring-primary w-48"
        />
        <Button
          data-testid="staff-login-btn"
          size="sm"
          onClick={() => handleSignIn()}
          disabled={authLoading}
        >
          {authLoading ? "Signing in..." : "Sign In"}
        </Button>
      </div>
    </div>
  );
}
