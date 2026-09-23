"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getStaffQuoteQueue, QuoteRequestStaff, QuoteStatus } from "@/lib/supabase/quotes";
import { supabase } from "@/lib/supabase/client";
import { QuoteResponseForm } from "@/components/admin/quote-response-form";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { AdminFilterTabs } from "@/components/admin/admin-filter-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}

const QUOTE_STATUSES = ["all", "new", "under_review", "quoted", "accepted", "declined"] as const;

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequestStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeQuote, setActiveQuote] = useState<QuoteRequestStaff | null>(null);

  // Staff role for the response form (display/session UI lives in the
  // shared StaffAuthGate; this page only tracks the role claim and
  // refreshes the queue on auth changes).
  const [userRole, setUserRole] = useState<string | null>(null);

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
    // Track the role claim for the response form; session display and
    // sign-in live in the shared StaffAuthGate.
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.app_metadata?.user_role;
      setUserRole(typeof role === "string" ? role : null);
      fetchQueue();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = session?.user?.app_metadata?.user_role;
      setUserRole(typeof role === "string" ? role : null);
      fetchQueue();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchQueue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Staff Quote Queue"
        description="Review incoming quote requests, set agreed pricing, and update customer status."
        actions={
          <Button variant="secondary" onClick={fetchQueue} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Queue"}
          </Button>
        }
      />

      <StaffAuthGate context="Sign in to manage quotes, update review status, and set customer pricing." />

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-blue-muted/10 p-4 rounded-none border border-border">
            <AdminFilterTabs
              options={QUOTE_STATUSES}
              value={selectedStatus as (typeof QUOTE_STATUSES)[number]}
              onChange={setSelectedStatus}
            />

            <label className="sr-only" htmlFor="quote-search">
              Search quotes
            </label>
            <input
              id="quote-search"
              type="text"
              placeholder="Search by quote #, customer, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64"
            />
          </div>

          {/* Quote Queue List */}
          {loading ? (
            <LoadingState text="Loading quote queue..." />
          ) : quotes.length === 0 ? (
            <EmptyState
              heading="No quote requests found"
              body="Try selecting a different status filter or clearing search terms."
            />
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
                      <span className="text-xs text-muted-foreground">
                        Submitted: {new Date(quote.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground pt-1">
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
                      <p className="text-xs text-muted-foreground">
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
