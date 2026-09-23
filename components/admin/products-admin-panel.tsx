"use client";

import React, { useState, useEffect } from "react";
import {
  AdminProduct,
  AdminCategory,
  ProductInput,
  ProductInputSchema,
} from "@/lib/supabase/catalog-admin";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { supabase } from "@/lib/supabase/client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type SaveResult = { success: boolean; error?: string };

interface ProductsAdminPanelProps {
  // GATE 023 (S1): data no longer arrives as an anon server-render prop.
  // The panel asks the session for its access token and calls this
  // token-scoped server action, which separates unauthorized / error /
  // honest-empty results for rendering.
  onLoad: (
    accessToken: string
  ) => Promise<ProtectedReadResult<{ products: AdminProduct[]; categories: AdminCategory[] }>>;
  branchId: string;
  onCreate: (accessToken: string, input: ProductInput) => Promise<SaveResult>;
  onUpdate: (accessToken: string, id: string, input: ProductInput) => Promise<SaveResult>;
  onDelete: (accessToken: string, id: string) => Promise<SaveResult>;
}

const STATUS_OPTIONS = ["active", "in_stock", "low_stock", "out_of_stock"] as const;

const EMPTY_FORM = (branchId: string): ProductInput => ({
  branch_id: branchId,
  category_id: null,
  name: "",
  sku: "",
  brand: "",
  size_spec: "",
  cost_price: 0,
  sell_price: 0,
  stock_quantity: 0,
  status: "active",
});

export function ProductsAdminPanel({
  onLoad,
  branchId,
  onCreate,
  onUpdate,
  onDelete,
}: ProductsAdminPanelProps) {
  const read = useProtectedRead(onLoad);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  useEffect(() => {
    if (read.status === "ready") setProducts(read.data.products);
  }, [read]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM(branchId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The browser holds the staff session; its access token is passed to the
  // server action so the write runs as the signed-in actor (RLS-enforced).
  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM(branchId));
    setError(null);
    setOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    setForm({
      branch_id: p.branch_id,
      category_id: p.category_id,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      size_spec: p.size_spec,
      cost_price: p.cost_price,
      sell_price: p.sell_price,
      stock_quantity: p.stock_quantity,
      status: p.status,
    });
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = ProductInputSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues.map((i) => i.message).join(", "));
      return;
    }
    setSaving(true);
    setError(null);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setSaving(false);
      setError("Sign in as a staff member before saving. Catalog writes are admin-only.");
      return;
    }
    const res = editingId
      ? await onUpdate(accessToken, editingId, validation.data)
      : await onCreate(accessToken, validation.data);
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Failed to save product.");
      return;
    }
    // Optimistic local refresh — reload happens on next navigation/revalidate.
    if (editingId) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, ...validation.data, margin: validation.data.sell_price - validation.data.cost_price } : p))
      );
    } else {
      setProducts((prev) => [
        ...prev,
        { ...validation.data, id: crypto.randomUUID(), margin: validation.data.sell_price - validation.data.cost_price, created_at: new Date().toISOString() },
      ]);
    }
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setDeleteError("Sign in as a staff member before deleting.");
      return;
    }
    const res = await onDelete(accessToken, pendingDelete.id);
    if (res.success) {
      setProducts((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleteError(null);
    } else {
      setDeleteError(res.error || "Failed to delete product.");
    }
  };

  // Distinct read outcomes (GATE 023 S1). Only a signed-in Admin with a
  // successful read reaches the table below, where an empty list honestly
  // means "no products configured" — never an authorization failure.
  if (read.status === "loading") {
    return <LoadingState text="Loading products..." testId="products-loading" />;
  }
  if (read.status === "unauthorized") {
    return (
      <ErrorState
        title="Could not read products — access denied."
        message={read.message}
        testId="products-unauthorized"
      />
    );
  }
  if (read.status === "error") {
    return (
      <ErrorState
        title="Could not read products — unexpected database error."
        message={read.message}
        testId="products-error"
      />
    );
  }

  const categories = read.data.categories;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="primary">
          + Add Product
        </Button>
      </div>

      <Card className="overflow-x-auto rounded-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">SKU</th>
              <th scope="col" className="px-4 py-3">Brand / Size</th>
              <th scope="col" className="px-4 py-3">Cost / Sell</th>
              <th scope="col" className="px-4 py-3">Margin</th>
              <th scope="col" className="px-4 py-3">Stock</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  data-testid="products-empty"
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products configured yet — add the first one above.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.brand} {p.size_spec ? `· ${p.size_spec}` : ""}
                </td>
                <td className="px-4 py-3">
                  KES {p.cost_price} / {p.sell_price}
                </td>
                <td className="px-4 py-3">KES {p.margin}</td>
                <td className="px-4 py-3">{p.stock_quantity}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "out_of_stock" ? "error" : p.status === "low_stock" ? "warning" : "success"}>
                    {p.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button variant="secondary" onClick={() => openEdit(p)} className="mr-2">
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={() => { setPendingDelete(p); setDeleteError(null); }}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-xl font-bold">
            {editingId ? "Edit Product" : "Add Product"}
          </DialogTitle>

          {error && (
            <div role="alert" className="p-3 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <FormField label="Product name" htmlFor="product-name">
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </FormField>
            <FormField label="SKU" htmlFor="product-sku">
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="font-mono"
                required
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Brand" htmlFor="product-brand">
                <Input
                  id="product-brand"
                  value={form.brand || ""}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </FormField>
              <FormField label="Size / Spec" htmlFor="product-size">
                <Input
                  id="product-size"
                  value={form.size_spec || ""}
                  onChange={(e) => setForm({ ...form, size_spec: e.target.value })}
                />
              </FormField>
            </div>

            <Select
              value={form.category_id || undefined}
              onValueChange={(v) => setForm({ ...form, category_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="product-cost">Cost price (KES)</label>
                <Input
                  id="product-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="product-sell">Sell price (KES)</label>
                <Input
                  id="product-sell"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.sell_price}
                  onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="product-stock">Stock qty</label>
                <Input
                  id="product-stock"
                  type="number"
                  min={0}
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                />
              </div>
            </div>

            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProductInput["status"] })}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} disabled={saving}>
                Save Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        title="Remove product"
        description={
          pendingDelete
            ? `Remove "${pendingDelete.name}" (${pendingDelete.sku}) from the catalogue? This cannot be undone.`
            : "Remove this product from the catalogue?"
        }
        confirmLabel="Remove product"
        destructive
        error={deleteError}
        onConfirm={confirmDelete}
        testId="confirm-delete-product"
      />
    </div>
  );
}
