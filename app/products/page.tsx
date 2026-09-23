import React, { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPublicProducts,
  getPublicCategories,
  getPublicVehicleFitments,
  getPrimaryBranch
} from "@/lib/supabase/catalog";
import { ProductCard } from "@/components/catalog/product-card";
import { CatalogEmptyState } from "@/components/catalog/catalog-empty-state";
import { VehicleFilterBar } from "@/components/catalog/vehicle-filter-bar";
import { SearchBar } from "@/components/catalog/search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Product Catalogue",
  description:
    "Browse our product catalogue. Quote-based pricing — request a quote on anything you need.",
};

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
      <PageHeader
        title="Product Catalogue"
        description="Browse our product catalogue. Quote-based pricing."
        actions={
          <Suspense fallback={<div className="h-10 w-64 bg-blue-muted/15 animate-pulse rounded-none" />}>
            <SearchBar />
          </Suspense>
        }
      />

      <Suspense fallback={<div className="h-24 bg-blue-muted/15 animate-pulse rounded-none" />}>
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
        resolvedParams.categoryId || resolvedParams.brand || resolvedParams.sizeSpec || resolvedParams.search ? (
          <EmptyState
            heading="No products found"
            body="Try resetting search or vehicle fitment filters."
            action={
              <Button asChild variant="secondary">
                <Link href="/products">Reset Filters</Link>
              </Button>
            }
          />
        ) : (
          <CatalogEmptyState kind="products" whatsappNumber={branch?.whatsapp} />
        )
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
