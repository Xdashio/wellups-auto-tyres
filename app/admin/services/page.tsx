import React from "react";
import {
  listServicesForAdmin,
  createService,
  updateService,
  deleteService,
  ServiceInput,
} from "@/lib/supabase/catalog-admin";
import { ServicesAdminPanel } from "@/components/admin/services-admin-panel";

export const revalidate = 0;

export default async function AdminServicesPage() {
  const { publicSupabase } = await import("@/lib/supabase/catalog");
  const services = await listServicesForAdmin(publicSupabase);

  async function handleCreate(input: ServiceInput) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return createService(publicSupabase, input);
  }

  async function handleUpdate(id: string, input: ServiceInput) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return updateService(publicSupabase, id, input);
  }

  async function handleDelete(id: string) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return deleteService(publicSupabase, id);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Garage Services</h1>
        <p className="text-sm text-text-secondary mt-1">
          Services have no listed price — every one is quoted after an inspection or
          request. Toggle availability instead of deleting when a service is paused.
        </p>
      </div>

      <ServicesAdminPanel
        initialServices={services}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
