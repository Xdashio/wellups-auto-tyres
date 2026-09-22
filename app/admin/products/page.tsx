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
import { ProductsAdminPanel } from "@/components/admin/products-admin-panel";

export const revalidate = 0;

export default async function AdminProductsPage() {
  const { publicSupabase } = await import("@/lib/supabase/catalog");
  const branch = await getPrimaryBranch();
  const [products, categories] = await Promise.all([
    listProductsForAdmin(publicSupabase),
    listCategoriesForAdmin(publicSupabase),
  ]);

  async function handleCreate(input: ProductInput) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return createProduct(publicSupabase, input);
  }

  async function handleUpdate(id: string, input: ProductInput) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return updateProduct(publicSupabase, id, input);
  }

  async function handleDelete(id: string) {
    "use server";
    const { publicSupabase } = await import("@/lib/supabase/catalog");
    return deleteProduct(publicSupabase, id);
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
