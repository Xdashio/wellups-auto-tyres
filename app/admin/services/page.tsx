import React from "react";
import {
  listServicesForAdmin,
  createService,
  updateService,
  deleteService,
  ServiceInput,
  AdminService,
} from "@/lib/supabase/catalog-admin";
import {
  scopedClientOrError,
  type ProtectedReadResult,
} from "@/lib/supabase/scoped-client";
import { ServicesAdminPanel } from "@/components/admin/services-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

// GATE 023 (defect S1): this page used to fetch services_admin with the
// ANON server client — post-016 that is a 42501 denial which the helper
// swallowed into [] (every operator saw "No services yet"). The read is
// now a token-scoped server action with a typed result; services_admin's
// predicate is request_role() = 'admin' (015), so Admin reads the
// projection, Manager/Cashier get an explicit unauthorized result, and
// Anon never gets a token. Disabled services stay reachable here because
// the admin view is unfiltered.
const ADMIN_ONLY_READ = "Catalogue management is Admin-only. Sign in with an Admin account.";

export default async function AdminServicesPage() {
  async function handleLoadServices(
    accessToken: string
  ): Promise<ProtectedReadResult<AdminService[]>> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { ok: false, kind: "unauthorized", message: gate.error };
    if (gate.role !== "admin") return { ok: false, kind: "unauthorized", message: ADMIN_ONLY_READ };
    return listServicesForAdmin(gate.scoped);
  }

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
        onLoad={handleLoadServices}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
