"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/services/booking-modal";

interface BookingButtonProps {
  serviceId: string;
  serviceName: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function BookingButton({
  serviceId,
  serviceName,
  variant = "primary",
  className,
}: BookingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setIsOpen(true)}
        data-testid="book-service-btn"
      >
        Book Service
      </Button>

      <BookingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        serviceId={serviceId}
        serviceName={serviceName}
      />
    </>
  );
}
