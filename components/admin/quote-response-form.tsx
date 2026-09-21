"use client";

import React, { useState } from "react";
import { QuoteRequestStaff, updateStaffQuoteResponse, QuoteStatus } from "@/lib/supabase/quotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QuoteResponseFormProps {
  quote: QuoteRequestStaff;
  onSuccess: () => void;
  onCancel: () => void;
}

export function QuoteResponseForm({ quote, onSuccess, onCancel }: QuoteResponseFormProps) {
  const [status, setStatus] = useState<QuoteStatus>(quote.status === "new" ? "quoted" : quote.status);
  const [offeredPrice, setOfferedPrice] = useState<string>(
    quote.offered_price ? quote.offered_price.toString() : ""
  );
  // Default validity period: 7 days from now if not set
  const defaultValidDate = quote.valid_until
    ? new Date(quote.valid_until).toISOString().slice(0, 10)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [validUntilDate, setValidUntilDate] = useState<string>(defaultValidDate);
  const [staffNotes, setStaffNotes] = useState<string>(quote.staff_notes || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const numericPrice = offeredPrice ? parseFloat(offeredPrice) : undefined;
    const isoValidUntil = validUntilDate ? new Date(validUntilDate).toISOString() : undefined;

    const res = await updateStaffQuoteResponse({
      quoteId: quote.id,
      status,
      offeredPrice: numericPrice,
      validUntil: isoValidUntil,
      staffNotes
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to update quote response.");
      return;
    }

    onSuccess();
  };

  const getWhatsAppMessageUrl = () => {
    const cleanPhone = quote.customer_phone.replace(/[^0-9]/g, "");
    if (!cleanPhone) return null;

    const itemName = quote.product_name || quote.service_name || "your requested item";
    const priceText = offeredPrice ? `KES ${parseFloat(offeredPrice).toLocaleString()}` : "[Price Pending]";
    const text = encodeURIComponent(
      `Hello ${quote.customer_name},\n\n` +
      `Regarding your Quote Request ${quote.quote_number} for ${itemName} (${quote.quantity} unit/s):\n` +
      `Our offered price is ${priceText}, valid until ${validUntilDate}.\n\n` +
      `Thank you for choosing Well Lups Auto Tyres Limited.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  const waUrl = getWhatsAppMessageUrl();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-950 p-6 rounded-lg border">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold">Quote Response — {quote.quote_number}</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Submitted {new Date(quote.created_at).toLocaleString()}
          </p>
        </div>
        <Badge tone={quote.status === "new" ? "warning" : quote.status === "quoted" ? "info" : "neutral"}>
          Status: {quote.status.toUpperCase()}
        </Badge>
      </div>

      {errorMessage && (
        <div className="p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded">
          {errorMessage}
        </div>
      )}

      {/* Customer & Item Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-blue-muted/10 p-4 rounded-md border border-blue-muted/20">
        <div>
          <span className="text-xs uppercase font-semibold text-text-secondary block">Customer Details</span>
          <p className="font-bold text-navy">{quote.customer_name}</p>
          <p className="font-mono text-xs">{quote.customer_phone}</p>
          {quote.customer_email && <p className="text-xs text-text-secondary">{quote.customer_email}</p>}
        </div>

        <div>
          <span className="text-xs uppercase font-semibold text-text-secondary block">Requested Item</span>
          <p className="font-bold text-navy">{quote.product_name || quote.service_name || "Custom Inquiry"}</p>
          <p className="text-xs text-text-secondary">Quantity: {quote.quantity}</p>
          {quote.vehicle_summary && (
            <p className="text-xs text-text-secondary">Vehicle: {quote.vehicle_summary}</p>
          )}
          {quote.customer_notes && (
            <p className="text-xs italic text-text-secondary mt-1">"{quote.customer_notes}"</p>
          )}
        </div>
      </div>

      {/* Staff Response Inputs */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Update Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QuoteStatus)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="quoted">Quoted (Provide Price)</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Offered Price (KES)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 15500.00"
              value={offeredPrice}
              onChange={(e) => setOfferedPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">
              Valid Until Date
            </label>
            <input
              type="date"
              value={validUntilDate}
              onChange={(e) => setValidUntilDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-navy mb-1">
            Internal Staff Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Internal pricing rationale, customer phone discussion notes..."
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t">
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded transition-colors"
          >
            Send Quote to Customer via WhatsApp
          </a>
        ) : (
          <div />
        )}

        <div className="flex gap-2 w-full sm:w-auto">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Quote Response"}
          </Button>
        </div>
      </div>
    </form>
  );
}
