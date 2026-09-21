import React, { Suspense } from "react";
import Link from "next/link";
import {
  getPublicProducts,
  getPublicCategories,
  getPublicVehicleFitments,
  getPrimaryBranch
} from "@/lib/supabase/catalog";
import { ProductCard } from "@/components/catalog/product-card";
import { VehicleFilterBar } from "@/components/catalog/vehicle-filter-bar";
import { SearchBar } from "@/components/catalog/search-bar";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

interface ProductsPageProps {
  searchParams: Promise<{
    categoryId?: string;
    brand?: string;
    sizeSpec?: string;
    search?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedParams = await searchParams;
  const products = await getPublicProducts(resolvedParams);
  const categories = await getPublicCategories();
  const fitments = await getPublicVehicleFitments();
  const branch = await getPrimaryBranch();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-text-secondary/15 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Product Catalogue</h1>
          <p className="text-text-secondary mt-1">
            Browse tyres, wheels, batteries, filters, and brake parts. Quote-based pricing.
          </p>
        </div>
        <Suspense fallback={<div className="h-10 w-64 bg-blue-muted/15 animate-pulse rounded" />}>
          <SearchBar />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-24 bg-blue-muted/15 animate-pulse rounded-lg" />}>
        <VehicleFilterBar fitments={fitments} />
      </Suspense>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/products">
          <Badge
            tone={!resolvedParams.categoryId ? "info" : "neutral"}
            className="cursor-pointer py-1.5 px-3 text-xs"
          >
            All Products
          </Badge>
        </Link>
        {categories.map((cat) => {
          const isActive = resolvedParams.categoryId === cat.id;
          return (
            <Link key={cat.id} href={`/products?categoryId=${cat.id}`}>
              <Badge
                tone={isActive ? "info" : "neutral"}
                className="cursor-pointer py-1.5 px-3 text-xs"
              >
                {cat.name}
              </Badge>
            </Link>
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-blue-muted/10">
          <p className="text-lg font-semibold text-text-secondary">No products found</p>
          <p className="text-sm text-text-secondary mt-1">
            Try resetting search or vehicle fitment filters.
          </p>
          <Link
            href="/products"
            className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
          >
            Reset Filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} whatsappNumber={branch?.whatsapp} />
          ))}
        </div>
      )}
    </div>
  );
}
