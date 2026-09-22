import React from "react";
import { getPrimaryBranch } from "@/lib/supabase/catalog";
import {
  listProductsForAdmin,
  listCategoriesForAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductInput,
} from "@/lib/supabase/catalog-admin";
import {
  clientWithAccessToken,
  verifiedStaffActor,
} from "@/lib/supabase/scoped-client";
import { ProductsAdminPanel } from "@/components/admin/products-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";

export const revalidate = 0;

// Every action runs as the signed-in staff member: the browser passes its
// session access token, the action validates it with the Auth server, and
// PostgREST/RLS enforces the real actor. No token (or a forged one) →
// server-side denial before any mutation. RLS remains authoritative.
async function scopedClientOrError(accessToken: string) {
  const scoped = clientWithAccessToken(accessToken);
  if (!scoped) return { error: "Not authenticated. Sign in as a staff member first." };
  const actor = await verifiedStaffActor(scoped);
  if ("error" in actor) return { error: actor.error };
  return { scoped };
}

export default async function AdminProductsPage() {
  const { publicSupabase } = await import("@/lib/supabase/catalog");
  const branch = await getPrimaryBranch();
  const [products, categories] = await Promise.all([
    listProductsForAdmin(publicSupabase),
    listCategoriesForAdmin(publicSupabase),
  ]);

  async function handleCreate(accessToken: string, input: ProductInput) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return createProduct(gate.scoped, input);
  }

  async function handleUpdate(accessToken: string, id: string, input: ProductInput) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return updateProduct(gate.scoped, id, input);
  }

  async function handleDelete(accessToken: string, id: string) {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { success: false, error: gate.error };
    return deleteProduct(gate.scoped, id);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Product Catalogue</h1>
        <p className="text-sm text-text-secondary mt-1">
          Add, edit, or retire products. Nothing here is displayed with a price to
          customers — pricing is used internally for margin tracking and to
          populate accepted quotes.
        </p>
      </div>

      <StaffAuthGate context="Sign in as an Admin to manage the product catalogue. Catalog writes are admin-only." />

      <ProductsAdminPanel
        initialProducts={products}
        categories={categories}
        branchId={branch?.id || ""}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
