"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { getWhatsAppQuoteUrl } from "@/lib/supabase/catalog";

interface QuoteButtonProps {
  whatsappNumber?: string | null;
  itemName: string;
  itemSku: string;
  sizeSpec?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function QuoteButton({ whatsappNumber, itemName, itemSku, sizeSpec, variant = "primary", className }: QuoteButtonProps) {
  const url = getWhatsAppQuoteUrl(whatsappNumber, itemName, itemSku, sizeSpec);

  if (!url) {
    return (
      <Button
        disabled
        variant="secondary"
        className={className}
        title="WhatsApp contact unconfigured. Please call branch directly."
      >
        Contact Branch
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant={variant}
      className={className}
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        Get a Quote
      </a>
    </Button>
  );
}
