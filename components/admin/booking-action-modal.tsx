"use client";

import React, { useState } from "react";
import { BookingStaff, BookingStatus, manageStaffBooking } from "@/lib/supabase/bookings";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BookingActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingStaff | null;
  userRole?: string | null;
  onSuccess: () => void;
}

export function BookingActionModal({
  isOpen,
  onClose,
  booking,
  userRole,
  onSuccess,
}: BookingActionModalProps) {
  const isCashier = userRole === "cashier";
  const isAdminOrManager = userRole === "admin" || userRole === "manager";

  // Default scheduled datetime to tomorrow at 10:00 AM in local timezone if not present
  const getDefaultScheduledTime = () => {
    if (booking?.scheduled_at) {
      return new Date(booking.scheduled_at).toISOString().slice(0, 16);
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const [scheduledAt, setScheduledAt] = useState<string>(getDefaultScheduledTime());
  const [staffNotes, setStaffNotes] = useState<string>(booking?.staff_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!booking) return null;

  const isTerminal = ["completed", "declined", "cancelled"].includes(booking.status);

  const handleAction = async (targetStatus: BookingStatus) => {
    setIsSubmitting(true);
    setErrorMessage("");

    let payloadScheduledAt: string | null = null;
    let payloadStaffNotes: string | null = null;

    if (targetStatus === "scheduled") {
      if (!scheduledAt) {
        setErrorMessage("A confirmed appointment date and time is required to schedule this booking.");
        setIsSubmitting(false);
        return;
      }
      const selectedDate = new Date(scheduledAt);
      if (selectedDate.getTime() <= Date.now()) {
        setErrorMessage("Confirmed appointment time must be in the future.");
        setIsSubmitting(false);
        return;
      }
      payloadScheduledAt = selectedDate.toISOString();
      payloadStaffNotes = staffNotes.trim() || null;
    } else if (targetStatus === "under_review" || targetStatus === "declined" || targetStatus === "cancelled") {
      payloadScheduledAt = null;
      payloadStaffNotes = staffNotes.trim() || null;
    } else if (targetStatus === "completed") {
      payloadScheduledAt = null;
      // Cashiers must NOT supply staff notes
      payloadStaffNotes = isCashier ? null : (staffNotes.trim() || null);
    }

    const res = await manageStaffBooking({
      bookingId: booking.id,
      status: targetStatus,
      scheduledAt: payloadScheduledAt,
      staffNotes: payloadStaffNotes,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to update booking status.");
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="booking-action-dialog">
        <div className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Manage Booking</DialogTitle>
            <Badge tone="info">ROLE: {(userRole || "CASHIER").toUpperCase()}</Badge>
          </div>
          <p className="text-xs font-mono text-primary font-bold mt-1">
            {booking.booking_number} — {booking.service_name}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded" data-testid="modal-error-message">
            {errorMessage}
          </div>
        )}

        {/* Customer & Request Summary */}
        <div className="p-3 bg-navy/5 rounded text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="font-semibold text-text-secondary">Customer:</span>
            <span className="text-navy font-medium">{booking.customer_name} ({booking.customer_phone})</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-text-secondary">Customer Requested Slot:</span>
            <span className="text-navy font-medium">{booking.requested_date} at {booking.requested_time}</span>
          </div>
          {booking.vehicle_summary && (
            <div className="flex justify-between">
              <span className="font-semibold text-text-secondary">Vehicle:</span>
              <span className="text-navy font-medium">{booking.vehicle_summary}</span>
            </div>
          )}
          {booking.customer_notes && (
            <div className="pt-1 border-t border-navy/10">
              <span className="font-semibold text-text-secondary">Customer Notes:</span>
              <p className="text-navy mt-0.5">{booking.customer_notes}</p>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-navy/10">
            <span className="font-semibold text-text-secondary">Current Status:</span>
            <span className="font-bold text-navy uppercase">{booking.status}</span>
          </div>
        </div>

        {/* Role Notice for Cashier */}
        {isCashier && !isTerminal && booking.status !== "scheduled" && (
          <div className="p-3 bg-warning/10 border border-warning/20 text-warning rounded text-xs" data-testid="cashier-readonly-notice">
            <p className="font-semibold">Cashier Operational View</p>
            <p>Cashiers are restricted from scheduling, declining, or modifying notes. Cashiers may only mark bookings as completed once work is finished in the workshop.</p>
          </div>
        )}

        {/* Terminal State Notice */}
        {isTerminal && (
          <div className="p-4 bg-muted border border-border text-muted-foreground rounded text-center text-xs space-y-1" data-testid="terminal-status-notice">
            <p className="font-bold uppercase">Terminal State: {booking.status}</p>
            <p>This booking has reached a final state and cannot be modified.</p>
          </div>
        )}

        {/* Action Controls based on Current Status and Role */}
        {!isTerminal && (
          <div className="space-y-4 pt-2">
            {/* Status = NEW */}
            {booking.status === "new" && (
              <>
                {isAdminOrManager ? (
                  <div className="space-y-3">
                    <p className="text-xs text-text-secondary">
                      Triage this booking request. Moving to <strong>Under Review</strong> allows scheduling workshop bays.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => handleAction("under_review")}
                        disabled={isSubmitting}
                        className="flex-1"
                        data-testid="move-under-review-btn"
                      >
                        {isSubmitting ? "Updating..." : "Move to Under Review"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleAction("declined")}
                        disabled={isSubmitting}
                        className="text-destructive hover:text-destructive/90"
                        data-testid="decline-booking-btn"
                      >
                        Decline Request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs text-text-secondary">
                    Waiting for Admin or Manager triage.
                  </div>
                )}
              </>
            )}

            {/* Status = UNDER_REVIEW */}
            {booking.status === "under_review" && (
              <>
                {isAdminOrManager ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="booking-scheduled-at-input" className="mb-1">
                        Confirmed Appointment Date & Time <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="booking-scheduled-at-input"
                        data-testid="booking-scheduled-at-input"
                        type="datetime-local"
                        required
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Sets the authoritative appointment timestamp for the customer and workshop.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="booking-staff-notes-input" className="mb-1">
                        Internal Staff Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="booking-staff-notes-input"
                        data-testid="booking-staff-notes-input"
                        rows={2}
                        placeholder="e.g. Assigned Bay 2, Technician David"
                        value={staffNotes}
                        onChange={(e) => setStaffNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        type="button"
                        onClick={() => handleAction("scheduled")}
                        disabled={isSubmitting}
                        className="flex-1"
                        data-testid="confirm-schedule-btn"
                      >
                        {isSubmitting ? "Scheduling..." : "Confirm & Schedule Appointment"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleAction("declined")}
                        disabled={isSubmitting}
                        className="text-destructive hover:text-destructive/90"
                        data-testid="decline-booking-btn"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs text-text-secondary">
                    Waiting for Admin or Manager to schedule.
                  </div>
                )}
              </>
            )}

            {/* Status = SCHEDULED */}
            {booking.status === "scheduled" && (
              <div className="space-y-3">
                <div className="p-3 bg-success/10 border border-success/20 rounded text-xs text-success">
                  <p className="font-semibold">Scheduled Appointment:</p>
                  <p className="font-bold text-sm">
                    {booking.scheduled_at
                      ? new Date(booking.scheduled_at).toLocaleString("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Pending"}
                  </p>
                  {booking.staff_notes && <p className="mt-1 text-text-secondary">Notes: {booking.staff_notes}</p>}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    onClick={() => handleAction("completed")}
                    disabled={isSubmitting}
                    variant="success"
                    className="flex-1"
                    data-testid="mark-completed-btn"
                  >
                    {isSubmitting ? "Completing..." : "Mark Service Completed"}
                  </Button>

                  {isAdminOrManager && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleAction("cancelled")}
                      disabled={isSubmitting}
                      className="text-destructive hover:text-destructive/90"
                      data-testid="cancel-booking-btn"
                    >
                      Cancel Appointment
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
