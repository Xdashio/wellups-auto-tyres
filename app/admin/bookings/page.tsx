"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getStaffBookingQueue, BookingStaff, BookingStatus } from "@/lib/supabase/bookings";
import { supabase } from "@/lib/supabase/client";
import { BookingActionModal } from "@/components/admin/booking-action-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeBooking, setActiveBooking] = useState<BookingStaff | null>(null);

  // Staff session state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

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
      if (user) {
        setUserEmail(user.email ?? null);
        setUserRole(user.app_metadata?.user_role ?? null);
        fetchQueue();
      } else {
        setBookings([]);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        setUserRole(session.user.app_metadata?.user_role ?? null);
        fetchQueue();
      } else {
        setUserEmail(null);
        setUserRole(null);
        setBookings([]);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchQueue]);

  const handleSignIn = async (emailToUse?: string, passwordToUse?: string) => {
    setAuthLoading(true);
    setLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse || loginEmail,
      password: passwordToUse || loginPassword,
    });
    setAuthLoading(false);
    if (error) {
      setLoginError(error.message);
    } else if (data.user) {
      setUserEmail(data.user.email ?? null);
      setUserRole(data.user.app_metadata?.user_role ?? null);
      setLoginEmail("");
      setLoginPassword("");
      await fetchQueue();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setUserRole(null);
    await fetchQueue();
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "new":
        return <Badge tone="warning">NEW</Badge>;
      case "under_review":
        return <Badge tone="info">UNDER REVIEW</Badge>;
      case "scheduled":
        return <Badge tone="success">SCHEDULED</Badge>;
      case "completed":
        return <Badge tone="success">COMPLETED</Badge>;
      case "declined":
        return <Badge tone="neutral">DECLINED</Badge>;
      case "cancelled":
        return <Badge tone="neutral">CANCELLED</Badge>;
      default:
        return <Badge tone="neutral">{(status as string).toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8" data-testid="admin-bookings-container">
      <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staff Service Booking Queue</h1>
          <p className="text-sm text-text-secondary mt-1">
            Review customer booking requests, schedule workshop appointments, and record in-shop completion.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchQueue} disabled={loading} data-testid="refresh-queue-btn">
          {loading ? "Refreshing..." : "Refresh Queue"}
        </Button>
      </div>

      {/* Staff Authentication & Role Control Banner */}
      {userEmail ? (
        <div
          data-testid="staff-session-bar"
          className="flex flex-wrap items-center justify-between gap-4 p-4 bg-navy/5 border border-navy/15 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-text-secondary tracking-wider">Staff Session:</span>
            <span data-testid="staff-email" className="font-mono text-sm font-semibold text-navy">
              {userEmail}
            </span>
            <Badge
              data-testid="staff-role"
              tone={userRole === "admin" ? "info" : userRole === "manager" ? "info" : "warning"}
            >
              ROLE: {(userRole || "CASHIER").toUpperCase()}
            </Badge>
          </div>
          <Button
            data-testid="staff-signout-btn"
            variant="ghost"
            onClick={handleSignOut}
            className="text-xs text-destructive hover:text-destructive/90 min-h-8 py-1 px-3"
          >
            Sign Out
          </Button>
        </div>
      ) : (
        <div
          data-testid="staff-auth-panel"
          className="p-4 bg-blue-muted/10 border border-blue-muted/30 rounded-lg space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-navy">Staff Authentication</h2>
              <p className="text-xs text-text-secondary">
                Sign in to manage bookings, review requests, schedule appointments, and complete services.
              </p>
            </div>
            {process.env.NODE_ENV === "development" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="login-admin-quick"
                onClick={() => handleSignIn("admin@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-navy text-white rounded hover:bg-navy/90 transition-colors"
              >
                Sign In as Admin
              </button>
              <button
                type="button"
                data-testid="login-manager-quick"
                onClick={() => handleSignIn("mgr@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Sign In as Manager
              </button>
              <button
                type="button"
                data-testid="login-cashier-quick"
                onClick={() => handleSignIn("cashier@test.local", "TestPassword123!")}
                disabled={authLoading}
                className="px-2.5 py-1 text-xs font-semibold bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
              >
                Sign In as Cashier
              </button>
            </div>
            )}
          </div>

          {loginError && (
            <div className="p-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded">
              {loginError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-navy/10">
            <input
              type="email"
              placeholder="Staff email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="px-2.5 py-1 text-xs border rounded focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="px-2.5 py-1 text-xs border rounded focus:outline-none focus:border-primary"
            />
            <Button
              variant="secondary"
              onClick={() => handleSignIn()}
              disabled={authLoading || !loginEmail || !loginPassword}
              className="min-h-8 py-1 text-xs"
            >
              Sign In
            </Button>
          </div>
        </div>
      )}

      {/* Filter Tabs and Search Controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 bg-navy/5 p-1 rounded-lg border border-navy/10" data-testid="status-filters">
            {[
              { id: "all", label: "All Bookings" },
              { id: "new", label: "New" },
              { id: "under_review", label: "Under Review" },
              { id: "scheduled", label: "Scheduled" },
              { id: "completed", label: "Completed" },
              { id: "declined", label: "Declined" },
              { id: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                data-testid={`filter-${tab.id}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedStatus === tab.id
                    ? "bg-white text-navy font-bold shadow-sm"
                    : "text-text-secondary hover:text-navy hover:bg-white/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input and Date Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs border rounded-md focus:outline-none focus:border-primary"
              title="Filter by requested date"
              data-testid="filter-date-input"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="text-xs text-text-secondary hover:text-destructive px-1"
                title="Clear date filter"
              >
                ✕
              </button>
            )}

            <input
              type="text"
              placeholder="Search reference, name, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-56 sm:w-64"
              data-testid="booking-search-input"
            />
          </div>
        </div>
      </div>

      {/* Booking List */}
      {loading ? (
        <div className="py-12 text-center text-text-secondary text-sm">Loading booking queue...</div>
      ) : bookings.length === 0 ? (
        <Card className="py-12 text-center text-text-secondary space-y-2">
          <p className="text-base font-semibold text-navy">No bookings found</p>
          <p className="text-xs">There are no service bookings matching the current filters.</p>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="booking-list">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
              data-testid={`booking-card-${booking.id}`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-primary">{booking.booking_number}</span>
                  {getStatusBadge(booking.status)}
                  <span className="text-xs text-text-secondary">
                    {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-text-secondary font-medium">Customer: </span>
                    <span className="font-semibold text-navy">{booking.customer_name}</span>{" "}
                    <span className="text-text-secondary">({booking.customer_phone})</span>
                  </div>
                  <div>
                    <span className="text-text-secondary font-medium">Service: </span>
                    <span className="font-semibold text-navy">{booking.service_name || "General Service"}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary font-medium">Requested Slot: </span>
                    <span className="text-navy">{booking.requested_date} @ {booking.requested_time}</span>
                  </div>
                </div>

                {booking.scheduled_at && (
                  <div className="text-xs bg-success/10 text-success border border-success/20 rounded px-2.5 py-1 inline-block">
                    <span className="font-semibold">Confirmed Appointment: </span>
                    {new Date(booking.scheduled_at).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                )}

                {booking.vehicle_summary && (
                  <div className="text-xs text-text-secondary">
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
