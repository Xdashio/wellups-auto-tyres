"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getStaffBookingQueue, BookingStaff, BookingStatus } from "@/lib/supabase/bookings";
import { supabase } from "@/lib/supabase/client";
import { BookingActionModal } from "@/components/admin/booking-action-modal";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { AdminFilterTabs } from "@/components/admin/admin-filter-tabs";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}

const BOOKING_STATUSES = [
  "all",
  "new",
  "under_review",
  "scheduled",
  "completed",
  "declined",
  "cancelled",
] as const;

const BOOKING_STATUS_LABELS: Record<string, string> = {
  all: "All Bookings",
  new: "New",
  under_review: "Under Review",
  scheduled: "Scheduled",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeBooking, setActiveBooking] = useState<BookingStaff | null>(null);

  // Staff role for the action modal (display/session UI lives in the
  // shared StaffAuthGate; this page only tracks the role claim and
  // refreshes the queue on auth changes).
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const filterStatus = selectedStatus === "all" ? undefined : (selectedStatus as BookingStatus);
    const data = await getStaffBookingQueue({
      status: filterStatus,
      search: searchTerm,
      date: selectedDate || undefined,
    });
    setBookings(data);
    setLoading(false);
  }, [selectedStatus, searchTerm, selectedDate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = user?.app_metadata?.user_role;
      setUserRole(typeof role === "string" ? role : null);
      fetchQueue();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = session?.user?.app_metadata?.user_role;
      setUserRole(typeof role === "string" ? role : null);
      fetchQueue();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchQueue]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8" data-testid="admin-bookings-container">
      <PageHeader
        title="Staff Service Booking Queue"
        description="Review customer booking requests, schedule workshop appointments, and record in-shop completion."
        actions={
          <Button variant="secondary" onClick={fetchQueue} disabled={loading} data-testid="refresh-queue-btn">
            {loading ? "Refreshing..." : "Refresh Queue"}
          </Button>
        }
      />

      <StaffAuthGate context="Sign in to manage bookings, review requests, schedule appointments, and complete services." />

      {/* Filter Tabs and Search Controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div data-testid="status-filters">
            <AdminFilterTabs
              options={BOOKING_STATUSES}
              value={selectedStatus as (typeof BOOKING_STATUSES)[number]}
              onChange={setSelectedStatus}
              formatLabel={(s) => BOOKING_STATUS_LABELS[s] ?? s}
              testIdPrefix="filter-"
            />
          </div>

          {/* Search Input and Date Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="booking-date-filter">
              Filter by requested date
            </label>
            <input
              id="booking-date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-border rounded-none focus:outline-none focus:border-primary"
              data-testid="filter-date-input"
            />
            {selectedDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate("")}
                aria-label="Clear date filter"
              >
                Clear
              </Button>
            )}

            <label className="sr-only" htmlFor="booking-search-input">
              Search bookings
            </label>
            <input
              id="booking-search-input"
              type="text"
              placeholder="Search reference, name, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-xs border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-56 sm:w-64"
              data-testid="booking-search-input"
            />
          </div>
        </div>
      </div>

      {/* Booking List */}
      {loading ? (
        <LoadingState text="Loading booking queue..." />
      ) : bookings.length === 0 ? (
        <EmptyState
          heading="No bookings found"
          body="There are no service bookings matching the current filters."
        />
      ) : (
        <div className="space-y-3" data-testid="booking-list">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
              data-testid={`booking-card-${booking.id}`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-primary">{booking.booking_number}</span>
                  <BookingStatusBadge status={booking.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium">Customer: </span>
                    <span className="font-semibold text-navy">{booking.customer_name}</span>{" "}
                    <span className="text-muted-foreground">({booking.customer_phone})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Service: </span>
                    <span className="font-semibold text-navy">{booking.service_name || "General Service"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Requested Slot: </span>
                    <span className="text-navy">{booking.requested_date} @ {booking.requested_time}</span>
                  </div>
                </div>

                {booking.scheduled_at && (
                  <div className="text-xs bg-success/10 text-success border border-success/20 rounded-sm px-2.5 py-1 inline-block">
                    <span className="font-semibold">Confirmed Appointment: </span>
                    {new Date(booking.scheduled_at).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                )}

                {booking.vehicle_summary && (
                  <div className="text-xs text-muted-foreground">
                    <span>Vehicle: </span>
                    <span className="text-navy">{booking.vehicle_summary}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <Button
                  variant="secondary"
                  onClick={() => setActiveBooking(booking)}
                  data-testid="manage-booking-btn"
                  data-booking-id={booking.id}
                  data-booking-status={booking.status}
                  className="text-xs min-h-8 py-1.5 px-3"
                >
                  Manage Booking
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {activeBooking && (
        <BookingActionModal
          isOpen={!!activeBooking}
          onClose={() => setActiveBooking(null)}
          booking={activeBooking}
          userRole={userRole}
          onSuccess={fetchQueue}
        />
      )}
    </div>
  );
}
