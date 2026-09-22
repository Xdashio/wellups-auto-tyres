import React from "react";
import {
  listServicesForAdmin,
  createService,
  updateService,
  deleteService,
  ServiceInput,
} from "@/lib/supabase/catalog-admin";
import {
  clientWithAccessToken,
  verifiedStaffActor,
} from "@/lib/supabase/scoped-client";
import { ServicesAdminPanel } from "@/components/admin/services-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

async function scopedClientOrError(accessToken: string) {
  const scoped = clientWithAccessToken(accessToken);
  if (!scoped) return { error: "Not authenticated. Sign in as a staff member first." };
  const actor = await verifiedStaffActor(scoped);
  if ("error" in actor) return { error: actor.error };
  return { scoped };
}

export default async function AdminServicesPage() {
  const { publicSupabase } = await import("@/lib/supabase/catalog");
  const services = await listServicesForAdmin(publicSupabase);

  async function handleCreate(accessToken: string, input: ServiceInput) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return createService(gate.scoped, input);
  }

  async function handleUpdate(accessToken: string, id: string, input: ServiceInput) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return updateService(gate.scoped, id, input);
  }

  async function handleDelete(accessToken: string, id: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return deleteService(gate.scoped, id);
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

      <StaffAuthGate context="Sign in as an Admin to manage garage services. Catalog writes are admin-only." />

      <ServicesAdminPanel
        initialServices={services}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
