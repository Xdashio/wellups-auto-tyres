"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { getGuestBooking, BookingCustomer, BookingStatus } from "@/lib/supabase/bookings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-text-secondary mt-2">Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md" data-testid="booking-not-found">
        <h1 className="text-2xl font-bold text-rose-600">Booking Not Found</h1>
        <p className="text-sm text-text-secondary mt-2">
          The requested booking reference or security token is invalid. Please check your link or contact the workshop.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "new":
        return <Badge tone="warning">STATUS: NEW</Badge>;
      case "under_review":
        return <Badge tone="info">STATUS: UNDER REVIEW</Badge>;
      case "scheduled":
        return <Badge tone="success">STATUS: SCHEDULED</Badge>;
      case "completed":
        return <Badge tone="success">STATUS: COMPLETED</Badge>;
      case "declined":
        return <Badge tone="neutral">STATUS: DECLINED</Badge>;
      case "cancelled":
        return <Badge tone="neutral">STATUS: CANCELLED</Badge>;
      default:
        return <Badge tone="neutral">STATUS: {(status as string).toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6" data-testid="booking-detail-view">
      <div className="border-b pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Booking Details</h1>
          <p className="font-mono text-sm font-semibold text-primary" data-testid="booking-number-display">
            {booking.booking_number}
          </p>
        </div>
        <div data-testid="booking-status-badge">{getStatusBadge(booking.status)}</div>
      </div>

      {/* Confirmed Appointment Banner (Only when scheduled or completed) */}
      {(booking.status === "scheduled" || booking.status === "completed") && booking.scheduled_at && (
        <div
          className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg space-y-1"
          data-testid="confirmed-appointment-banner"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🗓️</span>
            <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">
              Confirmed Workshop Appointment
            </span>
          </div>
          <p className="text-lg font-bold text-navy dark:text-gray-100" data-testid="confirmed-datetime-display">
            {new Date(booking.scheduled_at).toLocaleString("en-KE", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
          <p className="text-xs text-text-secondary">
            Our technicians will be prepared for your vehicle at this confirmed time.
          </p>
        </div>
      )}

      {/* Under Review Notice */}
      {booking.status === "under_review" && (
        <div className="p-4 bg-blue-muted/20 border border-blue-muted/40 rounded-lg text-sm text-navy space-y-1">
          <p className="font-semibold">Review in Progress</p>
          <p className="text-xs text-text-secondary">
            Our workshop team is reviewing capacity and scheduling your service appointment. You will see your confirmed appointment time here once scheduled.
          </p>
        </div>
      )}

      {/* New Request Notice */}
      {booking.status === "new" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-1">
          <p className="font-semibold">Request Submitted</p>
          <p className="text-xs text-amber-800">
            Submitting this request sends your preferred date and time to our workshop team. Your appointment is not confirmed until our team reviews the request and schedules it.
          </p>
        </div>
      )}

      {/* Declined / Cancelled Notice */}
      {booking.status === "declined" && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 space-y-1">
          <p className="font-semibold">Booking Request Declined</p>
          <p className="text-xs text-gray-600">
            Our workshop is unable to accommodate this booking request at the requested time. Please submit a new request with an alternate date or contact us.
          </p>
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 space-y-1">
          <p className="font-semibold">Appointment Cancelled</p>
          <p className="text-xs text-gray-600">
            This scheduled appointment has been cancelled by our workshop.
          </p>
        </div>
      )}

      {/* Booking Details Card */}
      <Card className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">
            Service Requested
          </h3>
          <p className="text-base font-bold text-navy" data-testid="booking-service-name">
            {booking.service_name || "General Service"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <h3 className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">
              Customer Preferred Date
            </h3>
            <p className="text-sm font-medium text-navy" data-testid="booking-requested-date">
              {booking.requested_date}
            </p>
            <span className="text-[11px] text-text-secondary">(Requested preference)</span>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">
              Customer Preferred Time
            </h3>
            <p className="text-sm font-medium text-navy" data-testid="booking-requested-time">
              {booking.requested_time}
            </p>
            <span className="text-[11px] text-text-secondary">(24-hour local time preference)</span>
          </div>
        </div>

        {booking.vehicle_summary && (
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">
              Vehicle Information
            </h3>
            <p className="text-sm text-navy" data-testid="booking-vehicle-summary">
              {booking.vehicle_summary}
            </p>
          </div>
        )}

        {booking.customer_notes && (
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase text-text-secondary tracking-wider mb-1">
              Service Notes
            </h3>
            <p className="text-sm text-navy whitespace-pre-line" data-testid="booking-customer-notes">
              {booking.customer_notes}
            </p>
          </div>
        )}

        <div className="border-t pt-4 flex justify-between text-xs text-text-secondary">
          <span>Requested on: {new Date(booking.created_at).toLocaleDateString()}</span>
          <span>Reference: {booking.booking_number}</span>
        </div>
      </Card>
    </div>
  );
}
