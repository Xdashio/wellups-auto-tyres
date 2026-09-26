"use client";

import React from "react";
import { QuoteMessage } from "@/lib/supabase/quotes";
import { MessageSquare, User, Settings, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";

interface QuoteConversationTimelineProps {
  messages: QuoteMessage[];
  isStaffView?: boolean;
}

function getEventIcon(eventType: string | null) {
  switch (eventType) {
    case "quote_created":
      return <FileText className="h-3.5 w-3.5" />;
    case "quote_reviewed":
      return <Clock className="h-3.5 w-3.5" />;
    case "quote_priced":
      return <FileText className="h-3.5 w-3.5" />;
    case "quote_accepted":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "quote_declined":
      return <XCircle className="h-3.5 w-3.5" />;
    case "payment_submitted":
      return <Clock className="h-3.5 w-3.5" />;
    case "payment_verified":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "payment_rejected":
      return <XCircle className="h-3.5 w-3.5" />;
    default:
      return <Settings className="h-3.5 w-3.5" />;
  }
}

function getEventLabel(eventType: string | null): string {
  switch (eventType) {
    case "quote_created":
      return "Quote Created";
    case "quote_reviewed":
      return "Moved to Review";
    case "quote_priced":
      return "Quotation Issued";
    case "quote_accepted":
      return "Quote Accepted";
    case "quote_declined":
      return "Quote Declined";
    case "payment_submitted":
      return "Payment Submitted";
    case "payment_verified":
      return "Payment Verified";
    case "payment_rejected":
      return "Payment Rejected";
    default:
      return "System Event";
  }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QuoteConversationTimeline({
  messages,
  isStaffView = false,
}: QuoteConversationTimelineProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted-foreground">
        No conversation history yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {messages.map((msg, idx) => {
        const isSystem = msg.sender_type === "system";
        const isCustomer = msg.sender_type === "customer";
        const isStaff = msg.sender_type === "staff";
        const isLastItem = idx === messages.length - 1;

        // System event rendering
        if (isSystem) {
          const isAcceptance = msg.event_type === "quote_accepted";
          const isDecline = msg.event_type === "quote_declined";

          return (
            <div
              key={msg.id}
              data-testid="timeline-system-event"
              data-event-type={msg.event_type}
              className={`flex items-center gap-2 py-2 px-3 text-xs font-medium ${
                isAcceptance
                  ? "text-success bg-success/5 border-l-2 border-success"
                  : isDecline
                  ? "text-destructive bg-destructive/5 border-l-2 border-destructive"
                  : "text-muted-foreground bg-muted/30 border-l-2 border-muted"
              }`}
            >
              {getEventIcon(msg.event_type)}
              <span className="font-semibold">{getEventLabel(msg.event_type)}</span>
              {msg.event_metadata && msg.event_type === "quote_priced" && (
                <span className="ml-1 font-mono text-navy">
                  KES {Number(msg.event_metadata.offered_price).toLocaleString()}
                </span>
              )}
              {msg.event_metadata && (msg.event_type === "payment_submitted" || msg.event_type === "payment_verified" || msg.event_type === "payment_rejected") && msg.event_metadata.amount && (
                <span className="ml-1 font-mono text-navy">
                  KES {Number(msg.event_metadata.amount).toLocaleString()}
                </span>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                {formatTime(msg.created_at)}
              </span>
            </div>
          );
        }

        // User message rendering (customer or staff)
        return (
          <div
            key={msg.id}
            data-testid={isCustomer ? "timeline-customer-message" : "timeline-staff-message"}
            className={`py-3 px-3 ${!isLastItem ? "border-b border-border/50" : ""} ${
              isCustomer ? "bg-card" : "bg-blue-muted/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isCustomer
                    ? "bg-primary/10 text-primary"
                    : "bg-navy/10 text-navy"
                }`}
              >
                {isCustomer ? (
                  <User className="h-3 w-3" />
                ) : (
                  <MessageSquare className="h-3 w-3" />
                )}
              </span>
              <span className={`text-xs font-bold ${isCustomer ? "text-primary" : "text-navy"}`}>
                {isCustomer ? msg.sender_display_name : (
                  isStaffView ? msg.sender_display_name : "Well Lups Team"
                )}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {formatTime(msg.created_at)}
              </span>
            </div>
            {msg.message_body && (
              <p className="text-sm text-foreground pl-7 whitespace-pre-wrap break-words">
                {msg.message_body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
