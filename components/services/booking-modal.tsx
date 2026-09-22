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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
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
          <DialogTitle className="text-xl font-bold">
            Book Service: {serviceName}
          </DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Request an appointment with our workshop technicians.
          </p>
        </div>

        {submittedBooking ? (
          <div
            className="space-y-4 py-4"
            data-testid="booking-success-view"
          >
            <div className="border border-success/20 bg-success/10 rounded-lg p-4 text-center space-y-3">
              <CheckCircle2
                className="mx-auto h-6 w-6 text-success"
                aria-hidden="true"
              />
              <span className="block text-2xl font-extrabold text-success">
                Booking Request Submitted
              </span>
              <p
                className="text-sm font-mono font-bold text-navy"
                data-testid="booking-reference-display"
              >
                Booking Reference: {submittedBooking.bookingNumber}
              </p>
              <Badge tone="warning" className="px-3 py-1 tracking-wider">
                PENDING REVIEW
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Submitting this request sends your preferred date and time to
                our workshop team. Your appointment is not confirmed until our
                team reviews the request and schedules it.
              </p>
            </div>

            <Button asChild variant="primary" className="w-full">
              <a
                href={`/bookings/${submittedBooking.bookingId}?token=${submittedBooking.secretToken}`}
                data-testid="track-booking-link"
              >
                View & Track Booking Status
              </a>
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleReset}
            >
              Close
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 py-2"
            data-testid="booking-request-form"
          >
            {errorMessage && (
              <div
                className="border border-destructive/20 bg-destructive/10 rounded p-3 text-xs font-medium text-destructive"
                data-testid="booking-error-message"
              >
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="booking-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-name"
                  type="text"
                  required
                  placeholder="e.g. John Kamau"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="booking-name-input"
                />
              </div>

              <div>
                <Label htmlFor="booking-phone">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-phone"
                  type="tel"
                  required
                  placeholder="e.g. 0712 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  data-testid="booking-phone-input"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="booking-email">
                Email Address{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="booking-email"
                type="email"
                placeholder="e.g. john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                data-testid="booking-email-input"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="booking-date">
                  Preferred Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-date"
                  type="date"
                  required
                  min={todayStr}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  data-testid="booking-date-input"
                />
              </div>

              <div>
                <Label htmlFor="booking-time">
                  Preferred Time (HH:MM){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-time"
                  type="time"
                  required
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  data-testid="booking-time-input"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="booking-vehicle">
                Vehicle Details{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="booking-vehicle"
                type="text"
                placeholder="e.g. Toyota Hilux KCC 789D"
                value={vehicleSummary}
                onChange={(e) => setVehicleSummary(e.target.value)}
                data-testid="booking-vehicle-input"
              />
            </div>

            <div>
              <Label htmlFor="booking-notes">
                Service Notes / Issues{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Textarea
                id="booking-notes"
                rows={2}
                placeholder="Describe any symptoms, issues, or specific requests..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                data-testid="booking-notes-input"
              />
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-0.5">
                Please Note:
              </p>
              <p data-testid="booking-clarification-notice">
                Submitting this request sends your preferred date and time to our
                workshop team. Your appointment is not confirmed until our team
                reviews the request and schedules it.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                data-testid="submit-booking-btn"
              >
                {isSubmitting ? "Submitting..." : "Submit Booking Request"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}