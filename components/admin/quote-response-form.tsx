"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  QuoteRequestStaff,
  updateStaffQuoteResponse,
  QuoteStatus,
  getStaffWhatsAppQuoteUrl,
  staffGetQuoteMessages,
  staffSendQuoteMessage,
  QuoteMessage,
} from "@/lib/supabase/quotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { QuoteConversationTimeline } from "@/components/quotes/quote-conversation-timeline";
import { QuoteMessageComposer } from "@/components/quotes/quote-message-composer";
import { MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuoteResponseFormProps {
  quote: QuoteRequestStaff;
  userRole?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function QuoteResponseForm({ quote, userRole, onSuccess, onCancel }: QuoteResponseFormProps) {
  const isCashier = userRole === "cashier";
  const isTerminal = ["accepted", "declined", "expired"].includes(quote.status);
  const isAlreadyQuoted = quote.status === "quoted";

  // Determine initial and allowed status transitions for staff
  const initialStatus: QuoteStatus =
    quote.status === "new"
      ? "under_review"
      : quote.status === "under_review"
      ? "quoted"
      : quote.status;

  const [status, setStatus] = useState<QuoteStatus>(initialStatus);
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

  // V0.6B: Conversation state
  const [conversationMessages, setConversationMessages] = useState<QuoteMessage[]>([]);
  const [conversationLoading, setConversationLoading] = useState(true);

  const canStaffMessage = userRole === "admin" || userRole === "manager";

  const loadConversation = useCallback(async () => {
    const msgs = await staffGetQuoteMessages(quote.id);
    setConversationMessages(msgs);
    setConversationLoading(false);
  }, [quote.id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  const handleStaffSendMessage = async (message: string) => {
    const result = await staffSendQuoteMessage(quote.id, message);
    if (result.success) {
      await loadConversation();
    }
    return result;
  };

  const controlsDisabled = isCashier || isTerminal || isAlreadyQuoted || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (controlsDisabled) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const numericPrice = offeredPrice ? parseFloat(offeredPrice) : undefined;
    const isoValidUntil = validUntilDate ? new Date(validUntilDate).toISOString() : undefined;

    if (status === "quoted") {
      if (!numericPrice || numericPrice <= 0) {
        setErrorMessage("A valid offered price (> 0) is required to quote this request.");
        setIsSubmitting(false);
        return;
      }

      if (!validUntilDate) {
        setErrorMessage("Quote validity date is required.");
        setIsSubmitting(false);
        return;
      }

      const selectedDate = new Date(validUntilDate);
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const maxAllowed = todayStart + 7 * 24 * 60 * 60 * 1000;
      const targetTime = selectedDate.getTime();

      if (isNaN(targetTime)) {
        setErrorMessage("Invalid validity date format.");
        setIsSubmitting(false);
        return;
      }

      if (targetTime < todayStart) {
        setErrorMessage("Quote validity date cannot be in the past.");
        setIsSubmitting(false);
        return;
      }

      if (targetTime > maxAllowed) {
        setErrorMessage("Quote validity cannot exceed 7 calendar days from quote issuance.");
        setIsSubmitting(false);
        return;
      }
    }

    const res = await updateStaffQuoteResponse({
      quoteId: quote.id,
      status,
      offeredPrice: numericPrice,
      validUntil: isoValidUntil,
      staffNotes: staffNotes || undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to update quote response.");
      return;
    }

    onSuccess();
  };

  const waUrl = getStaffWhatsAppQuoteUrl({
    customerPhone: quote.customer_phone,
    customerName: quote.customer_name,
    quoteNumber: quote.quote_number,
    quoteId: quote.id,
    secretToken: quote.secret_token,
    itemName: quote.product_name || quote.service_name || "your requested item",
    quantity: quote.quantity,
    offeredPrice,
    validUntilDate,
  });

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-card border border-border p-6 rounded-none"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold">
            Quote Response: {quote.quote_number}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted {new Date(quote.created_at).toLocaleString()}
          </p>
        </div>
        <Badge
          tone={
            quote.status === "new"
              ? "warning"
              : quote.status === "under_review"
              ? "info"
              : quote.status === "quoted"
              ? "info"
              : quote.status === "accepted"
              ? "success"
              : "neutral"
          }
        >
          Status: {quote.status.toUpperCase()}
        </Badge>
      </div>

      {/* Role Warnings & State-Machine Guidance */}
      {isCashier && (
        <div
          data-testid="cashier-readonly-notice"
          className="p-3 text-xs font-semibold text-warning bg-warning/10 border border-warning/20 rounded-none"
        >
          Cashier Access: Read-only. Pricing controls and status transitions are disabled for Cashier role.
        </div>
      )}

      {isAlreadyQuoted && (
        <div
          data-testid="quoted-locked-notice"
          className="p-3 text-xs font-semibold text-info bg-info/10 border border-info/20 rounded-none"
        >
          This quote has been QUOTED and is awaiting customer response. Staff cannot directly modify the pricing or status.
        </div>
      )}

      {isTerminal && (
        <div
          data-testid="terminal-locked-notice"
          className="p-3 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded-none"
        >
          This quote is in a terminal state ({quote.status.toUpperCase()}). Further modifications are prohibited.
        </div>
      )}

      {quote.status === "new" && !isCashier && (
        <div className="p-3 text-xs font-medium text-navy bg-blue-muted/10 border border-blue-muted/20 rounded-none">
          Step 1: Move quote to <strong>Under Review</strong> to triage request before pricing.
        </div>
      )}

      {quote.status === "under_review" && !isCashier && (
        <div className="p-3 text-xs font-medium text-navy bg-blue-muted/10 border border-blue-muted/20 rounded-none">
          Step 2: Enter offered price and validity date, then move status to <strong>Quoted</strong>.
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="p-3 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-none">
          {errorMessage}
        </div>
      )}

      {/* Customer & Item Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-blue-muted/10 p-4 rounded-none border border-blue-muted/20">
        <div>
          <span className="text-xs uppercase font-semibold text-muted-foreground block">Customer Details</span>
          <p className="font-bold text-navy">{quote.customer_name}</p>
          <p className="font-mono text-xs">{quote.customer_phone}</p>
          {quote.customer_email && <p className="text-xs text-muted-foreground">{quote.customer_email}</p>}
        </div>

        <div>
          <span className="text-xs uppercase font-semibold text-muted-foreground block">Requested Item</span>
          <p className="font-bold text-navy">{quote.product_name || quote.service_name || "Custom Inquiry"}</p>
          <p className="text-xs text-muted-foreground">Quantity: {quote.quantity}</p>
          {quote.vehicle_summary && (
            <p className="text-xs text-muted-foreground">Vehicle: {quote.vehicle_summary}</p>
          )}
          {quote.customer_notes && (
            <p className="text-xs italic text-muted-foreground mt-1">"{quote.customer_notes}"</p>
          )}
        </div>
      </div>

      {/* Staff Response Inputs */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="quote-status-select-trigger" className="mb-1">
              Update Status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as QuoteStatus)}
              disabled={controlsDisabled}
            >
              <SelectTrigger
                id="quote-status-select-trigger"
                data-testid="quote-status-select"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quote.status === "new" && (
                  <SelectItem value="under_review">
                    Under Review (Triage Quote)
                  </SelectItem>
                )}
                {quote.status === "under_review" && (
                  <SelectItem value="quoted">
                    Quoted (Provide Price & Validity)
                  </SelectItem>
                )}
                {quote.status === "quoted" && (
                  <SelectItem value="quoted">
                    Quoted (Awaiting Customer)
                  </SelectItem>
                )}
                {isTerminal && (
                  <SelectItem value={quote.status}>
                    {quote.status.toUpperCase()}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quote-offered-price-input" className="mb-1">
              Offered Price (KES)
            </Label>
            <Input
              id="quote-offered-price-input"
              data-testid="quote-offered-price-input"
              type="number"
              step="0.01"
              placeholder="e.g. 15500.00"
              value={offeredPrice}
              disabled={controlsDisabled || status === "under_review"}
              onChange={(e) => setOfferedPrice(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="quote-valid-until-input" className="mb-1">
              Valid Until Date
            </Label>
            <Input
              id="quote-valid-until-input"
              data-testid="quote-valid-until-input"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
              value={validUntilDate}
              disabled={controlsDisabled || status === "under_review"}
              onChange={(e) => setValidUntilDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="quote-staff-notes-input" className="mb-1">
            Internal Staff Notes (Optional)
          </Label>
          <Textarea
            id="quote-staff-notes-input"
            data-testid="quote-staff-notes-input"
            rows={2}
            placeholder="Internal pricing rationale, customer phone discussion notes..."
            value={staffNotes}
            disabled={controlsDisabled}
            onChange={(e) => setStaffNotes(e.target.value)}
          />
        </div>
      </div>

      {/* V0.6B: Quote Conversation Timeline */}
      <div className="border border-border rounded-none overflow-hidden">
        <div className="p-3 border-b border-border bg-blue-muted/5 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-navy" />
          <h3 className="text-sm font-bold text-navy">Quote Conversation</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-medium">
            {conversationMessages.length} {conversationMessages.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {conversationLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading conversation...</div>
        ) : (
          <QuoteConversationTimeline messages={conversationMessages} isStaffView={true} />
        )}

        {canStaffMessage && (
          <div className="p-3 border-t border-border bg-card">
            <QuoteMessageComposer
              onSend={handleStaffSendMessage}
              placeholder="Reply to customer..."
              senderLabel="Staff Reply"
            />
          </div>
        )}

        {!canStaffMessage && (
          <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 border-t">
            {isCashier ? "Cashier role: read-only access to quote conversation." : "Sign in as Admin or Manager to reply."}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-border">
        {waUrl && !controlsDisabled && status === "quoted" ? (
          <Button
            asChild
            variant="success"
            size="sm"
            className="w-full sm:w-auto gap-2"
          >
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send Quote to Customer via WhatsApp
            </a>
          </Button>
        ) : (
          <div />
        )}

        <div className="flex gap-2 w-full sm:w-auto">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            data-testid="save-quote-response-btn"
            type="submit"
            variant="primary"
            disabled={controlsDisabled}
          >
            {isSubmitting
              ? "Saving..."
              : isCashier
              ? "Pricing Disabled (Cashier)"
              : quote.status === "new"
              ? "Move to Under Review"
              : isAlreadyQuoted
              ? "Quoted (Awaiting Customer)"
              : isTerminal
              ? "Terminal State"
              : "Save Quote Response"}
          </Button>
        </div>
      </div>
    </form>
  );
}