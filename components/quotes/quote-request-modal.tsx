"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { createQuoteRequest, QuoteItemType } from "@/lib/supabase/quotes";
import { getWhatsAppQuoteUrl } from "@/lib/supabase/catalog";

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemSku?: string;
  itemType: QuoteItemType;
  productId?: string;
  serviceId?: string;
  sizeSpec?: string;
  whatsappNumber?: string | null;
}

export function QuoteRequestModal({
  isOpen,
  onClose,
  itemName,
  itemSku = "",
  itemType,
  productId,
  serviceId,
  sizeSpec,
  whatsappNumber,
}: QuoteRequestModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [vehicleSummary, setVehicleSummary] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customerNotes, setCustomerNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedQuote, setSubmittedQuote] = useState<{
    quoteNumber: string;
    quoteId: string;
    secretToken: string;
    waUrl: string | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage("Please fill in your name and phone number.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const res = await createQuoteRequest({
      customerName,
      customerPhone,
      customerEmail,
      itemType,
      productId,
      serviceId,
      vehicleSummary,
      quantity,
      customerNotes,
    });

    setIsSubmitting(false);

    if (!res.success || !res.quoteNumber || !res.quoteId || !res.secretToken) {
      setErrorMessage(res.error || "Failed to submit quote request. Please try again.");
      return;
    }

    // Generate WhatsApp URL if branch whatsapp is configured
    const waUrl = getWhatsAppQuoteUrl(whatsappNumber, itemName, itemSku || res.quoteNumber, sizeSpec);

    setSubmittedQuote({
      quoteNumber: res.quoteNumber,
      quoteId: res.quoteId,
      secretToken: res.secretToken,
      waUrl,
    });
  };

  const handleReset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setVehicleSummary("");
    setQuantity(1);
    setCustomerNotes("");
    setErrorMessage("");
    setSubmittedQuote(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="text-xl font-bold">Request a Quote: {itemName}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Submit your contact details for formal staff pricing and instant branch assistance.
          </p>
        </div>

        {submittedQuote ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg text-center space-y-3">
              <CheckCircle2 className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
              <span className="inline-block text-2xl font-extrabold text-success">
                Quote Submitted
              </span>
              <p className="text-sm font-mono font-bold text-navy">
                Quote Reference: {submittedQuote.quoteNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Our team at Well Lups Auto Tyres will review your request and contact you shortly.
              </p>
            </div>

            <Button asChild variant="primary" className="w-full">
              <a
                href={`/quotes/${submittedQuote.quoteId}?token=${submittedQuote.secretToken}`}
              >
                View & Track Quote Status
              </a>
            </Button>

            {submittedQuote.waUrl && (
              <Button asChild variant="outline" className="w-full">
                <a
                  href={submittedQuote.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Continue on WhatsApp with Quote Reference
                </a>
              </Button>
            )}

            <Button variant="secondary" className="w-full" onClick={handleReset}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {errorMessage && (
              <div className="p-3 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quote-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quote-name"
                  type="text"
                  required
                  placeholder="e.g. John Kamau"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="quote-phone">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quote-phone"
                  type="tel"
                  required
                  placeholder="e.g. 0712 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quote-email">Email Address (Optional)</Label>
                <Input
                  id="quote-email"
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="quote-quantity">Quantity Required</Label>
                <Input
                  id="quote-quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="quote-vehicle">Vehicle Make / Model (Optional)</Label>
              <Input
                id="quote-vehicle"
                type="text"
                placeholder="e.g. Toyota Hilux 2020 2.8L"
                value={vehicleSummary}
                onChange={(e) => setVehicleSummary(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="quote-notes">Additional Notes / Questions (Optional)</Label>
              <Textarea
                id="quote-notes"
                rows={2}
                placeholder="Specific requirements, fitment check, delivery preferences..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleReset} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Quote Request"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
