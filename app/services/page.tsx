import React from "react";
import type { Metadata } from "next";
import { getPublicServices, getPrimaryBranch } from "@/lib/supabase/catalog";
import { ServiceCard } from "@/components/catalog/service-card";
import { CatalogEmptyState } from "@/components/catalog/catalog-empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Garage Services",
  description:
    "Garage services with quote-based pricing — request a quote after inspection.",
};

export default async function ServicesPage() {
  const services = await getPublicServices();
  const branch = await getPrimaryBranch();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <PageHeader
        title="Garage Services"
        description={
          branch?.address
            ? `Professional auto services performed at our ${branch.address} branch.`
            : "Professional auto services with quote-based pricing."
        }
      />

      {/* Services Grid */}
      {services.length === 0 ? (
        <CatalogEmptyState kind="services" whatsappNumber={branch?.whatsapp} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} whatsappNumber={branch?.whatsapp} branchAddress={branch?.address} />
          ))}
        </div>
      )}
    </div>
  );
}
