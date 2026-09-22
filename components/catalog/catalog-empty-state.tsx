"use client";

import React from "react";
import { QuoteButton } from "@/components/catalog/quote-button";

// Shared empty-catalog state for /products and /services. The public
// catalog is intentionally empty until real rows arrive (see
// docs/PRODUCTION_DATA_CONTRACT.md), so this reads as "we're stocking this
// shop", not "something is broken". Category/service wording below repeats
// only phrases already used elsewhere on the site (homepage, footer,
// page headers) — no invented product names, prices, or brand claims.
// The CTA reuses the EXISTING quote-request flow (QuoteButton →
// create_quote_request RPC, item_type "custom") so demand is captured with
// zero catalog rows and no new request infrastructure.

const COPY = {
  products: {
    heading: "Our online catalogue is being stocked",
    body: "We are loading our full range of tyres, alloy wheels, batteries, brake parts, filters, and engine fluids onto this page. Meanwhile, tell us what you need and we will confirm availability and pricing straight away.",
    cta: "Ask us what you need",
    itemName: "General product enquiry",
  },
  services: {
    heading: "Our service menu is being published",
    body: "We are listing our garage services here — tyre fitting, wheel alignment, balancing, brake servicing, and battery checks. Meanwhile, tell us what your vehicle needs and we will confirm scope and pricing straight away.",
    cta: "Ask about a service",
    itemName: "General service enquiry",
  },
} as const;

export function CatalogEmptyState({
  kind,
  whatsappNumber,
}: {
  kind: "products" | "services";
  whatsappNumber?: string | null;
}) {
  const copy = COPY[kind];
  return (
    <div className="text-center py-16 px-6 border rounded-lg bg-blue-muted/10 space-y-4">
      <p className="text-lg font-semibold">{copy.heading}</p>
      <p className="text-sm text-text-secondary max-w-xl mx-auto">{copy.body}</p>
      <div className="pt-2">
        <QuoteButton
          whatsappNumber={whatsappNumber}
          itemName={copy.itemName}
          itemType="custom"
        />
      </div>
    </div>
  );
}
