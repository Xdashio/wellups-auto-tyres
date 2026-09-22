import React from "react";
import Link from "next/link";
import { getPublicServices, getPrimaryBranch } from "@/lib/supabase/catalog";
import { ServiceCard } from "@/components/catalog/service-card";
import { CatalogEmptyState } from "@/components/catalog/catalog-empty-state";

export const revalidate = 60;

export default async function ServicesPage() {
  const services = await getPublicServices();
  const branch = await getPrimaryBranch();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Garage Services</h1>
        <p className="text-muted-foreground mt-1">
          Professional auto services{branch?.address ? ` performed at our ${branch.address} branch` : ""}. Equal weight to retail products.
        </p>
      </div>

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
