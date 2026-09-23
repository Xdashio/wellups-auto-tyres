"use client";

import React from "react";
import { QuoteButton } from "@/components/catalog/quote-button";
import { EmptyState } from "@/components/ui/empty-state";

// Shared empty-catalog state for /products and /services. The public
// catalog is intentionally empty until real rows arrive (see
// docs/PRODUCTION_DATA_CONTRACT.md), so this reads as "we're stocking this
// shop", not "something is broken". Copy names no category, brand, price,
// or service — only the honest stocking state. The CTA reuses the
// EXISTING quote-request flow (QuoteButton → create_quote_request RPC,
// item_type "custom") so demand is captured with zero catalog rows and no
// new request infrastructure.

const COPY = {
  products: {
    heading: "Our online catalogue is being stocked",
    body: "We are loading our full product range onto this page. Meanwhile, tell us what you need and we will confirm availability and pricing straight away.",
    cta: "Ask us what you need",
    itemName: "General product enquiry",
  },
  services: {
    heading: "Our service menu is being published",
    body: "We are listing our garage services here. Meanwhile, tell us what your vehicle needs and we will confirm scope and pricing straight away.",
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
    <EmptyState
      heading={copy.heading}
      body={copy.body}
      action={
        <QuoteButton
          whatsappNumber={whatsappNumber}
          itemName={copy.itemName}
          itemType="custom"
        />
      }
    />
  );
}
