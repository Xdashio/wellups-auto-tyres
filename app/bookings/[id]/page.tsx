"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { getGuestBooking, BookingCustomer } from "@/lib/supabase/bookings";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";

interface GuestBookingPageProps {
  params: Promise<{ id: string }>;
}

export default function GuestBookingPage({ params }: GuestBookingPageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [booking, setBooking] = useState<BookingCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBooking() {
      if (!id || !token) {
        setLoading(false);
        return;
      }
      const data = await getGuestBooking(id, token);
      setBooking(data);
      setLoading(false);
    }
    loadBooking();
  }, [id, token]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <LoadingState text="Loading booking details..." />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl" data-testid="booking-not-found">
        <EmptyState
          heading="Booking Not Found"
          body="The requested booking reference or security token is invalid. Please check your link or contact the workshop."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6" data-testid="booking-detail-view">
      <PageHeader
        size="compact"
        title="Booking Details"
        description={
          <span className="font-mono text-sm font-semibold text-primary" data-testid="booking-number-display">
            {booking.booking_number}
          </span>
        }
        actions={
          <span data-testid="booking-status-badge">
            <BookingStatusBadge status={booking.status} />
          </span>
        }
      />

      {/* Confirmed Appointment Banner (Only when scheduled or completed) */}
      {(booking.status === "scheduled" || booking.status === "completed") && booking.scheduled_at && (
        <div
          className="p-4 bg-success/10 border border-success/20 rounded-none space-y-1"
          data-testid="confirmed-appointment-banner"
        >
          <p className="text-xs uppercase font-bold text-success tracking-wider">
            Confirmed Workshop Appointment
          </p>
          <p className="text-lg font-bold text-navy" data-testid="confirmed-datetime-display">
            {new Date(booking.scheduled_at).toLocaleString("en-KE", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Our technicians will be prepared for your vehicle at this confirmed time.
          </p>
        </div>
      )}

      {/* Under Review Notice */}
      {booking.status === "under_review" && (
        <div className="p-4 bg-blue-muted/20 border border-blue-muted/40 rounded-none text-sm text-navy space-y-1">
          <p className="font-semibold">Review in Progress</p>
          <p className="text-xs text-muted-foreground">
            Our workshop team is reviewing capacity and scheduling your service appointment. You will see your confirmed appointment time here once scheduled.
          </p>
        </div>
      )}

      {/* New Request Notice */}
      {booking.status === "new" && (
        <div className="p-4 bg-warning/10 border border-warning/20 rounded-none text-sm text-warning space-y-1">
          <p className="font-semibold">Request Submitted</p>
          <p className="text-xs text-warning">
            Submitting this request sends your preferred date and time to our workshop team. Your appointment is not confirmed until our team reviews the request and schedules it.
          </p>
        </div>
      )}

      {/* Declined / Cancelled Notice */}
      {booking.status === "declined" && (
        <div className="p-4 bg-muted border border-border rounded-none text-sm text-muted-foreground space-y-1">
          <p className="font-semibold">Booking Request Declined</p>
          <p className="text-xs text-muted-foreground">
            Our workshop is unable to accommodate this booking request at the requested time. Please submit a new request with an alternate date or contact us.
          </p>
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="p-4 bg-muted border border-border rounded-none text-sm text-muted-foreground space-y-1">
          <p className="font-semibold">Appointment Cancelled</p>
          <p className="text-xs text-muted-foreground">
            This scheduled appointment has been cancelled by our workshop.
          </p>
        </div>
      )}

      {/* Booking Details Card */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
            Service Requested
          </h2>
          <p className="text-base font-bold text-navy" data-testid="booking-service-name">
            {booking.service_name || "General Service"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Customer Preferred Date
            </h2>
            <p className="text-sm font-medium text-navy" data-testid="booking-requested-date">
              {booking.requested_date}
            </p>
            <span className="text-xs text-muted-foreground">(Requested preference)</span>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Customer Preferred Time
            </h2>
            <p className="text-sm font-medium text-navy" data-testid="booking-requested-time">
              {booking.requested_time}
            </p>
            <span className="text-xs text-muted-foreground">(24-hour local time preference)</span>
          </div>
        </div>

        {booking.vehicle_summary && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Vehicle Information
            </h2>
            <p className="text-sm text-navy" data-testid="booking-vehicle-summary">
              {booking.vehicle_summary}
            </p>
          </div>
        )}

        {booking.customer_notes && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Service Notes
            </h2>
            <p className="text-sm text-navy whitespace-pre-line" data-testid="booking-customer-notes">
              {booking.customer_notes}
            </p>
          </div>
        )}

        <div className="border-t pt-4 flex justify-between text-xs text-muted-foreground">
          <span>Requested on: {new Date(booking.created_at).toLocaleDateString()}</span>
          <span>Reference: {booking.booking_number}</span>
        </div>
      </Card>
    </div>
  );
}