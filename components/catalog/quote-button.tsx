"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuoteRequestModal } from "@/components/quotes/quote-request-modal";
import { QuoteItemType } from "@/lib/supabase/quotes";

interface QuoteButtonProps {
  whatsappNumber?: string | null;
  itemName: string;
  itemSku?: string;
  itemType?: QuoteItemType;
  productId?: string;
  serviceId?: string;
  sizeSpec?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function QuoteButton({
  whatsappNumber,
  itemName,
  itemSku = "",
  itemType = "product",
  productId,
  serviceId,
  sizeSpec,
  variant = "primary",
  className
}: QuoteButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setIsModalOpen(true)}
      >
        Get a Quote
      </Button>

      <QuoteRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        itemName={itemName}
        itemSku={itemSku}
        itemType={itemType}
        productId={productId}
        serviceId={serviceId}
        sizeSpec={sizeSpec}
        whatsappNumber={whatsappNumber}
      />
    </>
  );
}

