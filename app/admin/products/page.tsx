import React from "react";
import { getPrimaryBranch } from "@/lib/supabase/catalog";
import {
  listProductsForAdmin,
  listCategoriesForAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductInput,
  AdminProduct,
  AdminCategory,
} from "@/lib/supabase/catalog-admin";
import {
  scopedClientOrError,
  type ProtectedReadResult,
} from "@/lib/supabase/scoped-client";
import { ProductsAdminPanel } from "@/components/admin/products-admin-panel";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 0;

// Every action runs as the signed-in staff member: the browser passes its
// session access token, the action validates it with the Auth server, and
// PostgREST/RLS enforces the real actor. No token (or a forged one) →
// server-side denial before any mutation. RLS remains authoritative.
//
// GATE 023 (defect S1): reads used to run with the ANON server client and
// swallowed the 016 revocation into [] — every operator saw an empty
// catalogue. The read below is now a token-scoped server action returning
// a typed result that separates unauthorized / unexpected error / honest
// empty (products_admin's predicate is request_role() = 'admin', so only
// an Admin role reaches the data; Manager/Cashier get an explicit
// unauthorized result, Anon never gets a token).
const ADMIN_ONLY_READ = "Catalogue management is Admin-only. Sign in with an Admin account.";

export default async function AdminProductsPage() {
  const branch = await getPrimaryBranch();

  async function handleLoadProducts(
    accessToken: string
  ): Promise<ProtectedReadResult<{ products: AdminProduct[]; categories: AdminCategory[] }>> {
    "use server";
    const gate = await scopedClientOrError(accessToken);
    if ("error" in gate) return { ok: false, kind: "unauthorized", message: gate.error };
    if (gate.role !== "admin") return { ok: false, kind: "unauthorized", message: ADMIN_ONLY_READ };
    const [products, categories] = await Promise.all([
      listProductsForAdmin(gate.scoped),
      listCategoriesForAdmin(gate.scoped),
    ]);
    if (!products.ok) return products;
    if (!categories.ok) return categories;
    return { ok: true, data: { products: products.data, categories: categories.data } };
  }

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
      <PageHeader
        title="Product Catalogue"
        description="Add, edit, or retire products. Nothing here is displayed with a price to customers — pricing is used internally for margin tracking and to populate accepted quotes."
      />

      <StaffAuthGate context="Sign in as an Admin to manage the product catalogue. Catalog writes are admin-only." />

      <ProductsAdminPanel
        onLoad={handleLoadProducts}
        branchId={branch?.id || ""}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
