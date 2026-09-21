import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuoteButton } from "@/components/catalog/quote-button";
import { PublicProduct, getQualitativeStockStatus } from "@/lib/supabase/catalog";

interface ProductCardProps {
  product: PublicProduct;
  whatsappNumber?: string | null;
}

export function ProductCard({ product, whatsappNumber }: ProductCardProps) {
  const stockStatus = getQualitativeStockStatus(product.status);

  return (
    <Card data-testid="product-card" className="flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {product.brand}
          </span>
          <Badge tone={stockStatus.tone}>{stockStatus.label}</Badge>
        </div>

        <h3 className="text-lg font-bold line-clamp-2">
          <Link href={`/products/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>SKU: {product.sku}</span>
          {product.size_spec && (
            <span className="font-mono bg-blue-muted/15 px-2 py-0.5 rounded text-xs">
              {product.size_spec}
            </span>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-text-secondary/15 mt-4 flex gap-2">
        <Link href={`/products/${product.id}`} className="w-1/2">
          <button className="w-full text-sm font-medium py-2 px-3 rounded bg-blue-muted/15 hover:bg-blue-muted/25 text-navy transition-colors">
            View Details
          </button>
        </Link>
        <QuoteButton
          whatsappNumber={whatsappNumber}
          itemName={product.name}
          itemSku={product.sku}
          sizeSpec={product.size_spec}
          itemType="product"
          productId={product.id}
          className="w-1/2"
        />
      </div>
    </Card>
  );
}
