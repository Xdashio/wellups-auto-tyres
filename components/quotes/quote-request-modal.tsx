"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  whatsappNumber
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
      customerNotes
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
      waUrl
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
          <DialogTitle className="text-xl font-bold">Request a Quote — {itemName}</DialogTitle>
          <p className="text-xs text-text-secondary mt-1">
            Submit your contact details for formal staff pricing and instant branch assistance.
          </p>
        </div>

        {submittedQuote ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center space-y-2">
              <span className="inline-block text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ✓ Quote Submitted
              </span>
              <p className="text-sm font-mono font-bold text-navy dark:text-gray-200">
                Quote Reference: {submittedQuote.quoteNumber}
              </p>
              <p className="text-xs text-text-secondary">
                Our team at Well Lups Auto Tyres will review your request and contact you shortly.
              </p>
            </div>

            <a
              href={`/quotes/${submittedQuote.quoteId}?token=${submittedQuote.secretToken}`}
              className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-md transition-colors"
            >
              <span>View & Track Quote Status</span>
            </a>

            {submittedQuote.waUrl && (
              <a
                href={submittedQuote.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-md transition-colors"
              >
                <span>Continue on WhatsApp with Quote Reference</span>
              </a>
            )}

            <Button onClick={handleReset} variant="secondary" className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {errorMessage && (
              <div className="p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Kamau"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0712 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Quantity Required
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Vehicle Make / Model (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Toyota Hilux 2020 2.8L"
                value={vehicleSummary}
                onChange={(e) => setVehicleSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Additional Notes / Questions (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Specific requirements, fitment check, delivery preferences..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
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
