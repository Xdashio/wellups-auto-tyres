import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicServiceById, getPrimaryBranch } from "@/lib/supabase/catalog";
import { BookingButton } from "@/components/services/booking-button";
import { QuoteButton } from "@/components/catalog/quote-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const revalidate = 60;

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const service = await getPublicServiceById(id);
  if (!service) return { title: "Service not found" };
  return {
    title: service.name,
    description:
      `${service.name} at WELL LUPS AUTO TYRES LIMITED` +
      `${service.description ? ` — ${service.description}` : ""} ` +
      `Book a slot or request a quote. Priced by quote after inspection.`,
  };
}

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id } = await params;
  const service = await getPublicServiceById(id);

  if (!service) {
    notFound();
  }

  const branch = await getPrimaryBranch();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <nav className="text-sm text-text-secondary space-x-2">
        <Link href="/services" className="hover:underline">
          Services
        </Link>
        <span>/</span>
        <span className="text-navy font-medium">{service.name}</span>
      </nav>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="info">Garage Service</Badge>
            <Badge tone="neutral">Quote on Inspection</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
        </div>

        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-1">
              Description
            </h3>
            <p className="text-base text-navy leading-relaxed">
              {service.description || "Professional vehicle inspection and installation service."}
            </p>
          </div>

          {service.vehicle_types && service.vehicle_types.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Supported Vehicle Types
              </h3>
              <div className="flex flex-wrap gap-2">
                {service.vehicle_types.map((v, i) => (
                  <Badge key={i} tone="neutral" className="px-3 py-1">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="p-6 rounded-lg bg-blue-muted/15 border border-blue-muted/30 space-y-4">
          <h3 className="font-semibold text-lg">Book Service or Get a Quote</h3>
          <p className="text-sm text-text-secondary">
            Service scope and pricing depend on vehicle inspection. Submit a booking request to schedule your vehicle, or request formal pricing from our team.
          </p>
          <div className="flex flex-wrap gap-3">
            <BookingButton
              serviceId={service.id}
              serviceName={service.name}
              className="w-full sm:w-auto"
            />
            <QuoteButton
              whatsappNumber={branch?.whatsapp}
              itemName={service.name}
              itemSku={`SRV-${service.id.slice(0, 8)}`}
              itemType="service"
              serviceId={service.id}
              variant="secondary"
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
