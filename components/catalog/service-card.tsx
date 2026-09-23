import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuoteButton } from "@/components/catalog/quote-button";
import { PublicService } from "@/lib/supabase/catalog";

interface ServiceCardProps {
  service: PublicService;
  whatsappNumber?: string | null;
  branchAddress?: string | null;
}

export function ServiceCard({ service, whatsappNumber, branchAddress }: ServiceCardProps) {
  return (
    <Card data-testid="service-card" className="flex flex-col justify-between proto-ring-hover">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge tone="info">Garage Service</Badge>
          <span className="text-xs text-muted-foreground font-medium">Quote on Inspection</span>
        </div>

        <h3 className="text-lg font-bold">
          <Link href={`/services/${service.id}`} className="hover:underline">
            {service.name}
          </Link>
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-2">
          {service.description ||
            `Professional garage service${branchAddress ? ` performed at our ${branchAddress} branch` : ""}.`}
        </p>

        {service.vehicle_types && service.vehicle_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {service.vehicle_types.map((v, i) => (
              <span key={i} className="text-xs bg-blue-muted/15 text-navy px-2 py-0.5 rounded-sm">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border mt-4 flex gap-2">
        <Button asChild variant="secondary" className="w-1/2">
          <Link href={`/services/${service.id}`}>View Details</Link>
        </Button>
        <QuoteButton
          whatsappNumber={whatsappNumber}
          itemName={service.name}
          itemSku={`SRV-${service.id.slice(0, 8)}`}
          itemType="service"
          serviceId={service.id}
          className="w-1/2"
        />
      </div>
    </Card>
  );
}
