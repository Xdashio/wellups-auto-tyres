import { Badge } from "@/components/ui/badge";

// Shared status language for the customer tracking family (design
// contract §12): quote and booking pages map states through these
// helpers instead of hand-rolled tone switches. Status is always text,
// never color alone.
export function QuoteStatusBadge({ status }: { status: string }) {
  const tone =
    status === "accepted"
      ? "success"
      : status === "quoted"
        ? "info"
        : status === "new"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>STATUS: {status.toUpperCase()}</Badge>;
}

export function BookingStatusBadge({ status }: { status: string }) {
  const tone =
    status === "scheduled" || status === "completed"
      ? "success"
      : status === "under_review"
        ? "info"
        : status === "new"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>STATUS: {status.toUpperCase().replace(/_/g, " ")}</Badge>;
}
