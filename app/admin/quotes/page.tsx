"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getStaffQuoteQueue, QuoteRequestStaff, QuoteStatus } from "@/lib/supabase/quotes";
import { QuoteResponseForm } from "@/components/admin/quote-response-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequestStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeQuote, setActiveQuote] = useState<QuoteRequestStaff | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const filterStatus = selectedStatus === "all" ? undefined : (selectedStatus as QuoteStatus);
    const data = await getStaffQuoteQueue({ status: filterStatus, search: searchTerm });
    setQuotes(data);
    setLoading(false);
  }, [selectedStatus, searchTerm]);

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

      {activeQuote ? (
        <QuoteResponseForm
          quote={activeQuote}
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
                      : "bg-white dark:bg-gray-800 text-navy hover:bg-gray-100"
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
