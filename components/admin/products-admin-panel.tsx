"use client";

import React, { useState } from "react";
import { AdminProduct, AdminCategory, ProductInput, ProductInputSchema } from "@/lib/supabase/catalog-admin";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type SaveResult = { success: boolean; error?: string };

interface ProductsAdminPanelProps {
  initialProducts: AdminProduct[];
  categories: AdminCategory[];
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
  initialProducts,
  categories,
  branchId,
  onCreate,
  onUpdate,
  onDelete,
}: ProductsAdminPanelProps) {
  const [products, setProducts] = useState(initialProducts);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM(branchId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this product from the catalogue?")) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      alert("Sign in as a staff member before deleting.");
      return;
    }
    const res = await onDelete(accessToken, id);
    if (res.success) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(res.error || "Failed to delete product.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="primary">
          + Add Product
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Brand / Size</th>
              <th className="px-4 py-3">Cost / Sell</th>
              <th className="px-4 py-3">Margin</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  No products yet — add the first one above.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 text-text-secondary">
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
                  <Button variant="destructive" onClick={() => handleDelete(p.id)}>
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
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="font-mono"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Brand"
                value={form.brand || ""}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <Input
                placeholder="Size / Spec"
                value={form.size_spec || ""}
                onChange={(e) => setForm({ ...form, size_spec: e.target.value })}
              />
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
                <label className="text-xs text-text-secondary">Cost price (KES)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Sell price (KES)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.sell_price}
                  onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Stock qty</label>
                <Input
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
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Save Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
