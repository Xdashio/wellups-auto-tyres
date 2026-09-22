import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuoteButton } from "@/components/catalog/quote-button";
import { PublicService } from "@/lib/supabase/catalog";

interface ServiceCardProps {
  service: PublicService;
  whatsappNumber?: string | null;
  branchAddress?: string | null;
}

export function ServiceCard({ service, whatsappNumber, branchAddress }: ServiceCardProps) {
  return (
    <Card data-testid="service-card" className="flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge tone="info">Garage Service</Badge>
          <span className="text-xs text-text-secondary font-medium">Quote on Inspection</span>
        </div>

        <h3 className="text-lg font-bold">
          <Link href={`/services/${service.id}`} className="hover:underline">
            {service.name}
          </Link>
        </h3>

        <p className="text-sm text-text-secondary line-clamp-2">
          {service.description ||
            `Professional garage service${branchAddress ? ` performed at our ${branchAddress} branch` : ""}.`}
        </p>

        {service.vehicle_types && service.vehicle_types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {service.vehicle_types.map((v, i) => (
              <span key={i} className="text-xs bg-blue-muted/15 text-navy px-2 py-0.5 rounded">
                {v}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-text-secondary/15 mt-4 flex gap-2">
        <Link href={`/services/${service.id}`} className="w-1/2">
          <button className="w-full text-sm font-medium py-2 px-3 rounded bg-blue-muted/15 hover:bg-blue-muted/25 text-navy transition-colors">
            View Details
          </button>
        </Link>
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
