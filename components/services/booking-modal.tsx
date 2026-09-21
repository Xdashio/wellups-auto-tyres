"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createServiceBooking } from "@/lib/supabase/bookings";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
}

export function BookingModal({
  isOpen,
  onClose,
  serviceId,
  serviceName,
}: BookingModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  
  // Default requested date to tomorrow in local time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [requestedDate, setRequestedDate] = useState(defaultDateStr);
  const [requestedTime, setRequestedTime] = useState("10:00");
  const [vehicleSummary, setVehicleSummary] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedBooking, setSubmittedBooking] = useState<{
    bookingNumber: string;
    bookingId: string;
    secretToken: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMessage("Please fill in your name and phone number.");
      return;
    }
    if (!requestedDate) {
      setErrorMessage("Please select a preferred date.");
      return;
    }
    if (requestedDate < todayStr) {
      setErrorMessage("Requested date cannot be in the past.");
      return;
    }
    if (!requestedTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)) {
      setErrorMessage("Please enter a valid requested time in 24-hour HH:MM format (e.g. 09:30, 14:00).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const res = await createServiceBooking({
      serviceId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || undefined,
      requestedDate,
      requestedTime,
      vehicleSummary: vehicleSummary.trim() || undefined,
      customerNotes: customerNotes.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!res.success || !res.bookingId || !res.bookingNumber || !res.secretToken) {
      setErrorMessage(res.error || "Failed to submit booking request. Please try again.");
      return;
    }

    setSubmittedBooking({
      bookingNumber: res.bookingNumber,
      bookingId: res.bookingId,
      secretToken: res.secretToken,
    });
  };

  const handleReset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setRequestedDate(defaultDateStr);
    setRequestedTime("10:00");
    setVehicleSummary("");
    setCustomerNotes("");
    setErrorMessage("");
    setSubmittedBooking(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="text-xl font-bold">Book Service — {serviceName}</DialogTitle>
          <p className="text-xs text-text-secondary mt-1">
            Request an appointment with our workshop technicians.
          </p>
        </div>

        {submittedBooking ? (
          <div className="space-y-4 py-4" data-testid="booking-success-view">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center space-y-2">
              <span className="inline-block text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ✓ Booking Request Submitted
              </span>
              <p className="text-sm font-mono font-bold text-navy dark:text-gray-200" data-testid="booking-reference-display">
                Booking Reference: {submittedBooking.bookingNumber}
              </p>
              <div className="inline-block px-3 py-1 text-xs font-semibold uppercase bg-amber-100 text-amber-800 rounded-full">
                Status: PENDING REVIEW
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Submitting this request sends your preferred date and time to our workshop team. Your appointment is not confirmed until our team reviews the request and schedules it.
              </p>
            </div>

            <a
              href={`/bookings/${submittedBooking.bookingId}?token=${submittedBooking.secretToken}`}
              data-testid="track-booking-link"
              className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-md transition-colors"
            >
              <span>View & Track Booking Status</span>
            </a>

            <Button onClick={handleReset} variant="secondary" className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="booking-request-form">
            {errorMessage && (
              <div className="p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded" data-testid="booking-error-message">
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
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="booking-name-input"
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
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="booking-phone-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Email Address <span className="text-text-secondary font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="booking-email-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Preferred Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="booking-date-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy mb-1">
                  Preferred Time (HH:MM) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="booking-time-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Vehicle Details <span className="text-text-secondary font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Toyota Prado KCA 123X"
                value={vehicleSummary}
                onChange={(e) => setVehicleSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="booking-vehicle-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Service Notes / Issues <span className="text-text-secondary font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Describe any symptoms, issues, or specific requests..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                data-testid="booking-notes-input"
              />
            </div>

            <div className="p-3 bg-blue-muted/20 border border-blue-muted/40 rounded text-xs text-text-secondary">
              <p className="font-semibold text-navy mb-0.5">Please Note:</p>
              <p data-testid="booking-clarification-notice">
                Submitting this request sends your preferred date and time to our workshop team. Your appointment is not confirmed until our team reviews the request and schedules it.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="secondary" onClick={handleReset} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="submit-booking-btn">
                {isSubmitting ? "Submitting..." : "Submit Booking Request"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
