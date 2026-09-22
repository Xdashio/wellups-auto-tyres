"use client";

import React, { useState } from "react";
import { AdminService, ServiceInput, ServiceInputSchema } from "@/lib/supabase/catalog-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type SaveResult = { success: boolean; error?: string };

interface ServicesAdminPanelProps {
  initialServices: AdminService[];
  onCreate: (input: ServiceInput) => Promise<SaveResult>;
  onUpdate: (id: string, input: ServiceInput) => Promise<SaveResult>;
  onDelete: (id: string) => Promise<SaveResult>;
}

const EMPTY_FORM: ServiceInput = {
  name: "",
  description: "",
  vehicle_types: [],
  is_available: true,
};

export function ServicesAdminPanel({
  initialServices,
  onCreate,
  onUpdate,
  onDelete,
}: ServicesAdminPanelProps) {
  const [services, setServices] = useState(initialServices);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_FORM);
  const [vehicleTypesText, setVehicleTypesText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setVehicleTypesText("");
    setError(null);
    setOpen(true);
  };

  const openEdit = (s: AdminService) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description,
      vehicle_types: s.vehicle_types,
      is_available: s.is_available,
    });
    setVehicleTypesText(s.vehicle_types.join(", "));
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ServiceInput = {
      ...form,
      vehicle_types: vehicleTypesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    const validation = ServiceInputSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.issues.map((i) => i.message).join(", "));
      return;
    }
    setSaving(true);
    setError(null);
    const res = editingId
      ? await onUpdate(editingId, validation.data)
      : await onCreate(validation.data);
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Failed to save service.");
      return;
    }
    if (editingId) {
      setServices((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...validation.data } : s)));
    } else {
      setServices((prev) => [
        ...prev,
        { ...validation.data, id: crypto.randomUUID(), created_at: new Date().toISOString() },
      ]);
    }
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this service permanently? Consider toggling availability off instead.")) return;
    const res = await onDelete(id);
    if (res.success) {
      setServices((prev) => prev.filter((s) => s.id !== id));
    } else {
      alert(res.error || "Failed to delete service.");
    }
  };

  const toggleAvailability = async (s: AdminService) => {
    const updated = { name: s.name, description: s.description, vehicle_types: s.vehicle_types, is_available: !s.is_available };
    const res = await onUpdate(s.id, updated);
    if (res.success) {
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_available: updated.is_available } : x)));
    } else {
      alert(res.error || "Failed to update availability.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="primary">
          + Add Service
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {services.length === 0 && (
          <p className="text-text-secondary col-span-full text-center py-8">
            No services yet — add the first one above.
          </p>
        )}
        {services.map((s) => (
          <Card key={s.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{s.name}</h3>
              <Badge tone={s.is_available ? "success" : "neutral"}>
                {s.is_available ? "Available" : "Paused"}
              </Badge>
            </div>
            {s.description && <p className="text-sm text-text-secondary">{s.description}</p>}
            {s.vehicle_types.length > 0 && (
              <p className="text-xs text-text-secondary">Vehicle types: {s.vehicle_types.join(", ")}</p>
            )}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={s.is_available} onCheckedChange={() => toggleAvailability(s)} />
                Available
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(s)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(s.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-xl font-bold">
            {editingId ? "Edit Service" : "Add Service"}
          </DialogTitle>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Service name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Textarea
              placeholder="Description"
              rows={3}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              placeholder="Vehicle types, comma separated (e.g. sedan, SUV, truck)"
              value={vehicleTypesText}
              onChange={(e) => setVehicleTypesText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.is_available}
                onCheckedChange={(checked) => setForm({ ...form, is_available: checked })}
              />
              Available to customers
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Save Service"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
