"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { getGuestQuote, updateCustomerQuoteStatus, QuoteRequestCustomer, isQuoteExpired } from "@/lib/supabase/quotes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GuestQuotePageProps {
  params: Promise<{ id: string }>;
}

export default function GuestQuotePage({ params }: GuestQuotePageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [quote, setQuote] = useState<QuoteRequestCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string>("");

  useEffect(() => {
    async function loadQuote() {
      if (!id || !token) {
        setLoading(false);
        return;
      }
      const data = await getGuestQuote(id, token);
      setQuote(data);
      setLoading(false);
    }
    loadQuote();
  }, [id, token]);

  const handleUpdateStatus = async (status: "accepted" | "declined") => {
    if (!quote) return;
    setUpdating(true);
    const res = await updateCustomerQuoteStatus(quote.id, status, token);
    setUpdating(false);

    if (res.success) {
      setQuote({ ...quote, status });
      setActionSuccess(`Quote successfully marked as ${status}.`);
    } else {
      alert(res.error || "Failed to update quote status.");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-2">Loading quote details...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <h1 className="text-2xl font-bold text-destructive">Quote Not Found</h1>
        <p className="text-sm text-text-secondary mt-2">
          The requested quote reference or security token is invalid or expired.
        </p>
      </div>
    );
  }

  const expired = isQuoteExpired(quote.valid_until);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div className="border-b pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Quote Details</h1>
          <p className="font-mono text-sm font-semibold text-primary">{quote.quote_number}</p>
        </div>
        <Badge
          tone={
            quote.status === "accepted"
              ? "success"
              : quote.status === "quoted"
              ? "info"
              : quote.status === "new"
              ? "warning"
              : "neutral"
          }
        >
          STATUS: {quote.status.toUpperCase()}
        </Badge>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-success/10 border border-success/20 text-success text-sm font-medium rounded-md">
          {actionSuccess}
        </div>
      )}

      <Card className="space-y-4 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs uppercase font-semibold text-text-text-secondary block">Item</span>
            <p className="font-bold text-navy">{quote.product_name || quote.service_name || "Requested Item"}</p>
            <p className="text-xs text-text-secondary">Quantity: {quote.quantity}</p>
          </div>

          <div>
            <span className="text-xs uppercase font-semibold text-text-secondary block">Submitted Date</span>
            <p className="font-medium text-navy">{new Date(quote.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {quote.vehicle_summary && (
          <div className="pt-2 border-t">
            <span className="text-xs uppercase font-semibold text-text-secondary block">Vehicle Specification</span>
            <p className="text-sm font-medium text-navy">{quote.vehicle_summary}</p>
          </div>
        )}

        {quote.customer_notes && (
          <div className="pt-2 border-t">
            <span className="text-xs uppercase font-semibold text-text-secondary block">Your Notes</span>
            <p className="text-sm italic text-navy">"{quote.customer_notes}"</p>
          </div>
        )}

        {/* Pricing Box */}
        <div className="p-4 rounded-lg bg-blue-muted/15 border border-blue-muted/30 space-y-2 mt-4">
          <span className="text-xs uppercase font-semibold text-text-secondary block">Agreed Price</span>
          {quote.offered_price ? (
            <div>
              <p className="text-3xl font-extrabold text-navy">
                KES {quote.offered_price.toLocaleString()}
              </p>
              {quote.valid_until && (
                <p className={`text-xs mt-1 font-medium ${expired ? "text-destructive" : "text-success"}`}>
                  {expired ? "expired on " : "valid until "}{new Date(quote.valid_until).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-warning">
              Staff review in progress. Offered price will appear here once ready.
            </p>
          )}
        </div>

        {/* Customer Action Buttons when status === 'quoted' */}
        {quote.status === "quoted" && !expired && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="success"
              onClick={() => handleUpdateStatus("accepted")}
              disabled={updating}
              className="flex-1"
            >
              {updating ? "Updating..." : "Accept Quote"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleUpdateStatus("declined")}
              disabled={updating}
              className="flex-1 text-destructive hover:text-destructive/90"
            >
              {updating ? "Updating..." : "Decline Quote"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}