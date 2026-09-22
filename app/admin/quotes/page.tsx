"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getStaffQuoteQueue, QuoteRequestStaff, QuoteStatus } from "@/lib/supabase/quotes";
import { supabase } from "@/lib/supabase/client";
import { QuoteResponseForm } from "@/components/admin/quote-response-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequestStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeQuote, setActiveQuote] = useState<QuoteRequestStaff | null>(null);

  // Staff session state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const fetchQueue = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setQuotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const filterStatus = selectedStatus === "all" ? undefined : (selectedStatus as QuoteStatus);
    const data = await getStaffQuoteQueue({ status: filterStatus, search: searchTerm });
    setQuotes(data);
    setLoading(false);
  }, [selectedStatus, searchTerm]);

  useEffect(() => {
    // Check initial staff session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        setUserRole(user.app_metadata?.user_role ?? null);
      }
      fetchQueue();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        setUserRole(session.user.app_metadata?.user_role ?? null);
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
      fetchQueue();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchQueue]);

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
      setUserRole(data.user.app_metadata?.user_role ?? null);
      setLoginEmail("");
      setLoginPassword("");
      await fetchQueue();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setUserRole(null);
    await fetchQueue();
  };

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staff Quote Queue</h1>
          <p className="text-sm text-text-secondary mt-1">
            Review incoming quote requests, set agreed pricing, and update customer status.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchQueue} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Queue"}
        </Button>
      </div>

      {/* Staff Authentication & Role Control Banner */}
      {userEmail ? (
        <div data-testid="staff-session-bar" className="flex flex-wrap items-center justify-between gap-4 p-4 bg-navy/5 border border-navy/15 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-text-secondary tracking-wider">Staff Session:</span>
            <span data-testid="staff-email" className="font-mono text-sm font-semibold text-navy">
              {userEmail}
            </span>
            <Badge
              data-testid="staff-role"
              tone={userRole === "admin" ? "info" : userRole === "manager" ? "info" : "warning"}
            >
              ROLE: {(userRole || "CASHIER").toUpperCase()}
            </Badge>
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
      ) : (
        <div data-testid="staff-auth-panel" className="p-4 bg-blue-muted/10 border border-blue-muted/30 rounded-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-navy">Staff Authentication</h2>
              <p className="text-xs text-text-secondary">Sign in to manage quotes, update review status, and set customer pricing.</p>
            </div>
            {process.env.NODE_ENV === "development" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="login-admin-quick"
                onClick={() => handleSignIn("admin@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-navy text-white rounded hover:bg-navy/90 transition-colors"
              >
                Sign In as Admin
              </button>
              <button
                type="button"
                data-testid="login-manager-quick"
                onClick={() => handleSignIn("mgr@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Sign In as Manager
              </button>
              <button
                type="button"
                data-testid="login-cashier-quick"
                onClick={() => handleSignIn("cashier@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
              >
                Sign In as Cashier
              </button>
            </div>
            )}
          </div>

          {loginError && (
            <div className="p-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded">
              {loginError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <input
              data-testid="staff-login-email"
              type="email"
              placeholder="Staff Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
            <input
              data-testid="staff-login-password"
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-36"
            />
            <Button
              data-testid="staff-login-submit"
              variant="primary"
              onClick={() => handleSignIn()}
              disabled={authLoading}
              className="min-h-8 py-1 px-3 text-xs"
            >
              {authLoading ? "Authenticating..." : "Sign In"}
            </Button>
          </div>
        </div>
      )}

      {activeQuote ? (
        <QuoteResponseForm
          key={`${activeQuote.id}-${activeQuote.status}`}
          quote={activeQuote}
          userRole={userRole}
          onSuccess={() => {
            setActiveQuote(null);
            fetchQueue();
          }}
          onCancel={() => setActiveQuote(null)}
        />
      ) : (
        <div className="space-y-6">
          {/* Controls: Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-blue-muted/10 p-4 rounded-lg border">
            <div className="flex flex-wrap gap-2">
              {["all", "new", "under_review", "quoted", "accepted", "declined"].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors uppercase ${
                    selectedStatus === status
                      ? "bg-navy text-white"
                      : "bg-card text-navy hover:bg-muted"
                  }`}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search by quote #, customer, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64"
            />
          </div>

          {/* Quote Queue List */}
          {loading ? (
            <div className="text-center py-16">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-text-secondary mt-2">Loading quote queue...</p>
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-blue-muted/10">
              <p className="text-lg font-semibold text-text-secondary">No quote requests found</p>
              <p className="text-xs text-text-secondary mt-1">
                Try selecting a different status filter or clearing search terms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {quotes.map((quote) => (
                <Card key={quote.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary/50 transition-colors">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-extrabold text-navy text-base">
                        {quote.quote_number}
                      </span>
                      <Badge
                        tone={
                          quote.status === "new"
                            ? "warning"
                            : quote.status === "quoted"
                            ? "info"
                            : quote.status === "accepted"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {quote.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-text-secondary">
                        Submitted: {new Date(quote.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-text-secondary pt-1">
                      <div>
                        <span className="font-semibold text-navy">Customer:</span> {quote.customer_name} ({quote.customer_phone})
                      </div>
                      <div>
                        <span className="font-semibold text-navy">Item:</span> {quote.product_name || quote.service_name || "Custom Item"} (Qty: {quote.quantity})
                      </div>
                      <div>
                        <span className="font-semibold text-navy">Offered Price:</span>{" "}
                        {quote.offered_price ? `KES ${quote.offered_price.toLocaleString()}` : "Not Set"}
                      </div>
                    </div>

                    {quote.vehicle_summary && (
                      <p className="text-xs text-text-secondary">
                        <span className="font-medium text-navy">Vehicle:</span> {quote.vehicle_summary}
                      </p>
                    )}
                  </div>

                  <Button
                    data-testid="manage-quote-btn"
                    data-quote-id={quote.id}
                    data-quote-number={quote.quote_number}
                    data-quote-status={quote.status}
                    variant="primary"
                    onClick={() => setActiveQuote(quote)}
                    className="w-full md:w-auto"
                  >
                    Manage Quote
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
