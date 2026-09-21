import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProductById, getQualitativeStockStatus, getPrimaryBranch } from "@/lib/supabase/catalog";
import { QuoteButton } from "@/components/catalog/quote-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const revalidate = 60;

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getPublicProductById(id);

  if (!product) {
    notFound();
  }

  const branch = await getPrimaryBranch();
  const stockStatus = getQualitativeStockStatus(product.status);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <nav className="text-sm text-text-secondary space-x-2">
        <Link href="/products" className="hover:underline">
          Products
        </Link>
        <span>/</span>
        <span className="text-navy font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="bg-blue-muted/15 aspect-square rounded-lg border border-text-secondary/25 flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-4xl font-extrabold text-navy/40 mb-2">
              {product.brand}
            </div>
            <p className="text-sm font-mono text-text-secondary">{product.size_spec || "Standard Spec"}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="info" className="uppercase font-semibold tracking-wider">
                {product.brand}
              </Badge>
              <Badge tone={stockStatus.tone}>{stockStatus.label}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-sm text-text-secondary font-mono mt-1">SKU: {product.sku}</p>
          </div>

          <Card className="space-y-3">
            <div className="flex justify-between text-sm py-1 border-b border-text-secondary/15">
              <span className="text-text-secondary">Pricing Model</span>
              <span className="font-semibold text-primary">Quote on Inspection / Request</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-text-secondary/15">
              <span className="text-text-secondary">Specification / Size</span>
              <span className="font-mono font-medium">{product.size_spec || "Standard"}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-text-secondary">Availability</span>
              <span className="font-medium">{stockStatus.label}</span>
            </div>
          </Card>

          <div className="p-4 rounded-lg bg-blue-muted/15 border border-blue-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">Need pricing or installation details?</h3>
            <p className="text-xs text-text-secondary">
              Request an instant quote directly with our team at the Industrial Area branch via WhatsApp.
            </p>
            <QuoteButton
              whatsappNumber={branch?.whatsapp}
              itemName={product.name}
              itemSku={product.sku}
              sizeSpec={product.size_spec}
              itemType="product"
              productId={product.id}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
