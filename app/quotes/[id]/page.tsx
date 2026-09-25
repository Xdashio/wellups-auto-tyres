"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getGuestQuote,
  updateCustomerQuoteStatus,
  getQuoteMessages,
  sendQuoteMessage,
  QuoteRequestCustomer,
  QuoteMessage,
  isQuoteExpired,
} from "@/lib/supabase/quotes";
import { customerSubmitPayment, customerGetQuotePayments, PaymentRecord } from "@/lib/supabase/payments";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteStatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { QuoteConversationTimeline } from "@/components/quotes/quote-conversation-timeline";
import { QuoteMessageComposer } from "@/components/quotes/quote-message-composer";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, ShieldCheck, MessageSquare } from "lucide-react";

interface GuestQuotePageProps {
  params: Promise<{ id: string }>;
}

export default function GuestQuotePage({ params }: GuestQuotePageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [quote, setQuote] = useState<QuoteRequestCustomer | null>(null);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!id || !token) return;
    const data = await getQuoteMessages(id, token);
    setMessages(data);
  }, [id, token]);

  const loadPayments = useCallback(async () => {
    if (!id || !token) return;
    const data = await customerGetQuotePayments(id, token);
    setPayments(data);
  }, [id, token]);

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
    loadMessages();
    loadPayments();
  }, [id, token, loadMessages, loadPayments]);

  const handleUpdateStatus = async (status: "accepted" | "declined") => {
    if (!quote) return;
    setUpdating(true);
    setActionError(null);
    const res = await updateCustomerQuoteStatus(quote.id, status, token);
    setUpdating(false);

    if (res.success) {
      setQuote({
        ...quote,
        status,
        accepted_at: status === "accepted" ? new Date().toISOString() : quote.accepted_at,
      });
      setActionSuccess(`Quote successfully marked as ${status}.`);
      // Reload messages to include the system event
      await loadMessages();
    } else {
      setActionError(res.error || "Failed to update quote status.");
    }
  };

  const handleSendMessage = async (message: string) => {
    const result = await sendQuoteMessage(id, token, message);
    if (result.success) {
      await loadMessages();
    }
    return result;
  };

  const handleSubmitPayment = async () => {
    setActionError(null);
    setActionSuccess("");
    if (!quote || !id) return;
    const ref = paymentRef.trim().toUpperCase();
    if (!/^ [A-Z0-9]{10}$/.test(ref) && !/^[A-Z0-9]{10}$/.test(ref)) {
      setActionError("M-Pesa reference must be 10 uppercase alphanumeric characters");
      return;
    }
    setSubmittingPayment(true);
    const res = await customerSubmitPayment({
      quoteId: id,
      token,
      providerReference: ref,
      payerPhone: payerPhone || undefined,
      payerName: undefined,
      paymentChannel: "mpesa",
    });
    setSubmittingPayment(false);
    if (res.success) {
      setActionSuccess("Payment submitted successfully. Pending verification.");
      setPaymentRef("");
      setPayerPhone("");
      await loadPayments();
    } else {
      setActionError(res.error || "Payment submission failed");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <LoadingState text="Loading quote details..." />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <EmptyState
          heading="Quote Not Found"
          body="The requested quote reference or security token is invalid or expired."
        />
      </div>
    );
  }

  const expired = isQuoteExpired(quote.valid_until);
  const isTerminal = quote.status === "declined" || (quote.status === "expired") || (quote.status === "quoted" && expired);
  const canMessage = !isTerminal && quote.status !== "declined";

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      {/* 1. Header & Live Status */}
      <PageHeader
        size="compact"
        title="Quote Details"
        description={
          <span className="font-mono text-sm font-semibold text-primary">{quote.quote_number}</span>
        }
        actions={<QuoteStatusBadge status={quote.status} />}
      />

      {/* Action Banners */}
      {actionSuccess && (
        <div
          data-testid="action-success-banner"
          className="p-4 bg-success/10 border border-success/20 text-success text-sm font-medium rounded-none flex items-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <ErrorState
          title="Could not update this quote"
          message={actionError}
          retryLabel="Dismiss"
          onRetry={() => setActionError(null)}
        />
      )}

      {/* 2. Commercial Quotation Details Card */}
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Requested Item
            </span>
            <p className="font-bold text-navy text-base">
              {quote.product_name || quote.service_name || "Requested Item"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Quantity: {quote.quantity}</p>
          </div>

          <div>
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Submitted Date
            </span>
            <p className="font-medium text-navy">{new Date(quote.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {quote.vehicle_summary && (
          <div className="pt-3 border-t">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Vehicle Specification
            </span>
            <p className="text-sm font-medium text-navy">{quote.vehicle_summary}</p>
          </div>
        )}

        {quote.customer_notes && (
          <div className="pt-3 border-t">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Your Notes
            </span>
            <p className="text-sm italic text-navy">"{quote.customer_notes}"</p>
          </div>
        )}

        {/* Pricing Box */}
        <div className="p-4 rounded-none bg-blue-muted/15 border border-blue-muted/30 space-y-2 mt-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase font-semibold text-muted-foreground block">
                Agreed Offered Price
              </span>
              {quote.offered_price ? (
                <div>
                  <p className="text-3xl font-extrabold text-navy">
                    KES {quote.offered_price.toLocaleString()}
                  </p>
                  <span className="inline-block text-[11px] font-semibold text-muted-foreground mt-0.5">
                    100% Full Payment Required on Acceptance
                  </span>
                </div>
              ) : (
                <p className="text-sm font-semibold text-warning mt-1">
                  Staff review in progress. Offered price will appear here once ready.
                </p>
              )}
            </div>

            {quote.valid_until && (
              <div className="text-right">
                <span className="text-xs uppercase font-semibold text-muted-foreground block">
                  Quote Validity
                </span>
                <p className={`text-xs mt-1 font-semibold ${expired ? "text-destructive" : "text-success"}`}>
                  {expired ? "expired on " : "valid until "}{new Date(quote.valid_until).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Actions When status === 'quoted' */}
        {quote.status === "quoted" && !expired && (
          <div className="pt-4 border-t space-y-3">
            <div className="p-3 bg-muted/40 border border-border text-xs text-muted-foreground">
              Please review your quote terms. You can accept this quotation to proceed to payment, or decline if no longer required.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
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
          </div>
        )}

        {/* 4. Action / Details Panel When status === 'accepted' */}
        {quote.status === "accepted" && (
          <div
            data-testid="quote-accepted-panel"
            className="pt-4 border-t space-y-4"
          >
            <div className="p-4 bg-success/10 border border-success/30 rounded-none space-y-2">
              <div className="flex items-center gap-2 text-success font-bold text-sm">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>Acceptance Confirmed — Commercial Terms Locked</span>
              </div>
              <p className="text-xs text-navy/80">
                You accepted this quotation on{" "}
                <strong>
                  {new Date(quote.accepted_at || quote.updated_at).toLocaleString()}
                </strong>
                . The agreed amount of{" "}
                <strong className="text-navy">
                  KES {quote.offered_price?.toLocaleString()}
                </strong>{" "}
                is frozen and cannot be altered.
              </p>
            </div>

            {/* Next Step: Full Payment Notice */}
            <div
              data-testid="next-step-payment-panel"
              className="p-4 bg-blue-muted/10 border border-blue-muted/30 rounded-none space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-navy block">
                  Next Step: Full Payment Required (100%)
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  KES {quote.offered_price?.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                In accordance with Well Lups commercial terms, 100% full payment is required prior to order dispatch or workshop service execution. No deposit or partial payment is accepted.
              </p>
              <div className="p-2.5 bg-background border border-border text-[11px] text-muted-foreground font-medium">
                Payment Verification Notice: No payment has been verified yet. Stock remains in pool until full payment verification and counter sale completion.
              </div>

              {/* Payment submission form */}
              <div className="pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">M-Pesa Transaction Reference</label>
                    <input
                      data-testid="payment-reference-input"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value.toUpperCase())}
                      placeholder="10 characters"
                      className="w-full border rounded px-2 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Payer Phone</label>
                    <input
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="07..."
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <Button
                  data-testid="submit-payment-button"
                  onClick={handleSubmitPayment}
                  disabled={submittingPayment}
                  size="sm"
                >
                  {submittingPayment ? "Submitting..." : "Submit Payment"}
                </Button>

                {payments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-xs uppercase font-semibold text-muted-foreground">Payment History</span>
                    {payments.map(p => (
                      <div key={p.id} data-testid="payment-record" className="text-xs border rounded p-2 bg-background">
                        <div className="flex justify-between">
                          <span className="font-mono">{p.payment_number}</span>
                          <span className="uppercase">{p.status}</span>
                        </div>
                        <div>Ref: {p.provider_reference} | Amount: KES {p.amount?.toLocaleString()}</div>
                        {p.verified_at && <div>Verified: {new Date(p.verified_at).toLocaleString()}</div>}
                        {p.rejection_reason && <div className="text-destructive">Rejected: {p.rejection_reason}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. Status Panel When status === 'declined' */}
        {quote.status === "declined" && (
          <div
            data-testid="quote-declined-panel"
            className="pt-4 border-t p-4 bg-destructive/5 border border-destructive/20 rounded-none space-y-3"
          >
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>Quotation Declined</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This quotation was marked as declined. No further commercial actions can be taken on this reference. If your requirements have changed, you can submit a new quote request from our catalog.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/products" className="inline-flex items-center gap-1.5">
                <span>Browse Products</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* 6. Status Panel When status === 'expired' */}
        {(quote.status === "expired" || (quote.status === "quoted" && expired)) && (
          <div
            data-testid="quote-expired-panel"
            className="pt-4 border-t p-4 bg-warning/10 border border-warning/30 rounded-none space-y-3"
          >
            <div className="flex items-center gap-2 text-warning font-bold text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Quotation Expired</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This quotation expired on {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : "past date"}. Well Lups quotes carry a maximum validity of 7 calendar days. Expired quotes cannot be accepted.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/products" className="inline-flex items-center gap-1.5">
                <span>Request a New Quote</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* 7. Status Panel When status === 'new' or 'under_review' */}
        {(quote.status === "new" || quote.status === "under_review") && (
          <div className="pt-4 border-t p-4 bg-muted/30 border border-border rounded-none space-y-2">
            <div className="flex items-center gap-2 text-navy font-semibold text-xs">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span>Technical Review in Progress</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Our workshop team is reviewing your vehicle details and checking inventory stock. Your official price offer will appear on this page as soon as review is complete.
            </p>
          </div>
        )}
      </Card>

      {/* 8. Conversation & Audit Timeline */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border bg-blue-muted/5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-navy" />
            <h2 className="text-sm font-bold text-navy">Quote Conversation</h2>
            <span className="ml-auto text-[10px] text-muted-foreground font-medium">
              {messages.length} {messages.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>

        <QuoteConversationTimeline messages={messages} isStaffView={false} />

        {/* Message Composer */}
        {canMessage && (
          <div className="p-4 border-t border-border bg-card">
            <QuoteMessageComposer
              onSend={handleSendMessage}
              placeholder="Send a message to Well Lups team..."
              senderLabel="Your Message"
            />
          </div>
        )}

        {isTerminal && (
          <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 border-t">
            This quote is in a terminal state. The conversation history is preserved for your records.
          </div>
        )}
      </Card>
    </div>
  );
}