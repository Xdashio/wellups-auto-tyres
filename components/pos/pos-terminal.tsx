"use client";

import React, { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  type POSProduct,
  type CheckoutPayload,
  type CompletedSaleResult,
} from "@/lib/supabase/pos";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  calculateCartTotals,
  type CartItem,
} from "@/lib/services/cart";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface POSTerminalProps {
  onLoadProducts: (accessToken: string) => Promise<ProtectedReadResult<POSProduct[]>>;
  onCheckout: (accessToken: string, payload: CheckoutPayload) => Promise<CompletedSaleResult>;
}

export function POSTerminal({ onLoadProducts, onCheckout }: POSTerminalProps) {
  const read = useProtectedRead(onLoadProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSaleResult | null>(null);

  // Active products in the catalogue
  const activeProducts = useMemo(() => {
    if (read.status !== "ready") return [];
    return read.data.filter((p) => p.status === "active");
  }, [read]);

  // Filter active products by search query
  const products = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.size_spec && p.size_spec.toLowerCase().includes(query))
    );
  }, [activeProducts, searchQuery]);

  const totals = useMemo(() => calculateCartTotals(cart), [cart]);

  const handleAdd = (product: POSProduct) => {
    setCart((prev) => addToCart(prev, product, 1));
    setCheckoutError(null);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    setCart((prev) => updateQuantity(prev, productId, qty));
    setCheckoutError(null);
  };

  const handleRemove = (productId: string) => {
    setCart((prev) => removeFromCart(prev, productId));
    setCheckoutError(null);
  };

  const handleClear = () => {
    setCart([]);
    setCheckoutError(null);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setCheckoutError("No active staff session. Please sign in again.");
        return;
      }

      const payload: CheckoutPayload = {
        items: cart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      };

      const result = await onCheckout(token, payload);
      if (!result.ok) {
        setCheckoutError(result.error || "Checkout failed. Please retry.");
        return;
      }

      setCompletedSale(result);
      setCart([]);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Unexpected error during checkout");
    } finally {
      setIsProcessing(false);
    }
  };

  if (read.status === "loading") {
    return <LoadingState text="Loading point of sale catalogue..." testId="pos-loading" />;
  }

  if (read.status === "unauthorized") {
    return (
      <ErrorState
        title="POS Access Denied"
        message={read.message}
        testId="pos-unauthorized"
      />
    );
  }

  if (read.status === "error") {
    return (
      <ErrorState
        title="Catalogue Loading Error"
        message={read.message}
        testId="pos-error"
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="pos-terminal">
      {checkoutError && (
        <ErrorState
          title="Checkout Error"
          message={checkoutError}
          testId="pos-checkout-error"
        />
      )}

      {/* Main POS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Product Search and Catalogue Lookup (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 rounded-none space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-navy tracking-tight">Product Lookup</h2>
              <div className="w-full sm:w-64">
                <Input
                  type="search"
                  placeholder="Search name, SKU, brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs rounded-none"
                  data-testid="pos-product-search"
                />
              </div>
            </div>

            {activeProducts.length === 0 ? (
              <div className="py-8" data-testid="pos-empty-catalog">
                <EmptyState
                  heading="Catalogue is currently empty"
                  body="No products are currently available in the POS catalogue. Add products in the Admin panel to begin processing in-shop sales."
                />
              </div>
            ) : products.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground" data-testid="pos-no-match">
                No products match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-border border-t border-border overflow-y-auto max-h-[560px]">
                {products.map((product) => {
                  const cartItem = cart.find((c) => c.productId === product.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;
                  const isOutOfStock = product.stock_quantity <= 0;
                  const isMaxedOut = inCartQty >= product.stock_quantity;

                  return (
                    <div
                      key={product.id}
                      className="py-3 px-1 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      data-testid={`pos-product-row-${product.sku}`}
                    >
                      <div className="min-w-44 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground uppercase">
                            {product.sku}
                          </span>
                          {product.stock_quantity <= 0 ? (
                            <Badge tone="neutral">Out of Stock</Badge>
                          ) : product.stock_quantity <= 5 ? (
                            <Badge tone="warning">Low: {product.stock_quantity}</Badge>
                          ) : (
                            <Badge tone="success">{product.stock_quantity} available</Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground mt-0.5">{product.name}</h3>
                        {(product.brand || product.size_spec) && (
                          <p className="text-xs text-muted-foreground">
                            {[product.brand, product.size_spec].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-navy font-mono">
                            KES {product.sell_price.toLocaleString()}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAdd(product)}
                          disabled={isOutOfStock || isMaxedOut}
                          className="text-xs min-h-8 px-3 rounded-none"
                          data-testid={`pos-add-btn-${product.sku}`}
                        >
                          {isOutOfStock ? "Out of Stock" : isMaxedOut ? "Max in Cart" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Active Cart & Checkout (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 rounded-none space-y-4" data-testid="pos-cart-panel">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy tracking-tight">Active Cart</h2>
                <Badge tone="info" className="text-xs">
                  {totals.totalItems} {totals.totalItems === 1 ? "item" : "items"}
                </Badge>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                >
                  Clear Cart
                </Button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground space-y-1" data-testid="empty-cart-state">
                <p className="font-semibold text-foreground">Cart is empty</p>
                <p className="text-xs">Select products from the lookup pane to ring up a sale.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-border max-h-[380px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className="py-3 flex items-center justify-between gap-2"
                      data-testid={`pos-cart-item-${item.sku}`}
                    >
                      <div className="min-w-36 flex-1">
                        <span className="font-mono text-[10px] text-muted-foreground block">
                          {item.sku}
                        </span>
                        <h4 className="text-xs font-bold text-foreground leading-tight">
                          {item.name}
                        </h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          KES {item.sellPrice.toLocaleString()} each
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center border border-border bg-card text-foreground font-bold hover:bg-muted text-xs transition-colors rounded-none"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono text-xs font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.stockQuantity}
                          className="w-7 h-7 flex items-center justify-center border border-border bg-card text-foreground font-bold hover:bg-muted text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.productId)}
                          className="ml-1 text-muted-foreground hover:text-destructive text-sm px-1.5"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          &times;
                        </button>
                      </div>

                      <div className="w-24 text-right">
                        <span className="font-mono text-xs font-bold text-navy">
                          KES {(item.quantity * item.sellPrice).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Unique Items:</span>
                    <span className="font-mono font-medium">{totals.totalUniqueItems}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total Units:</span>
                    <span className="font-mono font-medium">{totals.totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border text-base font-bold text-navy">
                    <span>Sale Total:</span>
                    <span className="font-mono text-lg" data-testid="pos-total-amount">
                      KES {totals.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Checkout Action Button */}
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCompleteSale}
                  loading={isProcessing}
                  disabled={isProcessing || cart.length === 0}
                  className="w-full mt-4 rounded-none font-bold tracking-wide uppercase text-sm"
                  data-testid="pos-complete-sale-btn"
                >
                  {isProcessing ? "Processing Sale..." : "Complete Sale"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sale Completion Modal */}
      {completedSale && (
        <ConfirmationDialog
          open={Boolean(completedSale)}
          onOpenChange={(open) => {
            if (!open) setCompletedSale(null);
          }}
          title="Sale Completed Successfully"
          description={`Sale #${completedSale.sale_number} recorded. Total: KES ${completedSale.total_amount?.toLocaleString() ?? 0} (${completedSale.items?.length ?? 0} line items). Inventory decremented atomically.`}
          confirmLabel="Start New Sale"
          cancelLabel="Close"
          destructive={false}
          onConfirm={async () => {
            setCompletedSale(null);
          }}
          testId="pos-sale-success-dialog"
        />
      )}
    </div>
  );
}
