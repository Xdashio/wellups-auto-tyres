"use client";

import React, { useState, useEffect } from "react";
import { AdminService, ServiceInput, ServiceInputSchema } from "@/lib/supabase/catalog-admin";
import type { ProtectedReadResult } from "@/lib/supabase/scoped-client";
import { supabase } from "@/lib/supabase/client";
import { useProtectedRead } from "@/components/admin/use-protected-read";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { FormField } from "@/components/ui/form-field";

type SaveResult = { success: boolean; error?: string };

interface ServicesAdminPanelProps {
  // GATE 023 (S1): token-scoped read instead of an anon server-render prop,
  // so unauthorized / error / honest-empty stay distinguishable.
  onLoad: (accessToken: string) => Promise<ProtectedReadResult<AdminService[]>>;
  onCreate: (accessToken: string, input: ServiceInput) => Promise<SaveResult>;
  onUpdate: (accessToken: string, id: string, input: ServiceInput) => Promise<SaveResult>;
  onDelete: (accessToken: string, id: string) => Promise<SaveResult>;
}

const EMPTY_FORM: ServiceInput = {
  name: "",
  description: "",
  vehicle_types: [],
  is_available: true,
};

export function ServicesAdminPanel({
  onLoad,
  onCreate,
  onUpdate,
  onDelete,
}: ServicesAdminPanelProps) {
  const read = useProtectedRead(onLoad);
  const [services, setServices] = useState<AdminService[]>([]);
  useEffect(() => {
    if (read.status === "ready") setServices(read.data);
  }, [read]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_FORM);
  const [vehicleTypesText, setVehicleTypesText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminService | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // The browser holds the staff session; its access token is passed to the
  // server action so the write runs as the signed-in actor (RLS-enforced).
  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setDeleteError("Sign in as a staff member before deleting.");
      return;
    }
    const res = await onDelete(accessToken, pendingDelete.id);
    if (res.success) {
      setServices((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
      setDeleteError(null);
    } else {
      setDeleteError(res.error || "Failed to delete service.");
    }
  };

  const toggleAvailability = async (s: AdminService) => {
    const updated = { name: s.name, description: s.description, vehicle_types: s.vehicle_types, is_available: !s.is_available };
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setRowError("Sign in as a staff member before changing availability.");
      return;
    }
    const res = await onUpdate(accessToken, s.id, updated);
    if (res.success) {
      setRowError(null);
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_available: updated.is_available } : x)));
    } else {
      setRowError(res.error || "Failed to update availability.");
    }
  };

  // Distinct read outcomes (GATE 023 S1): only a signed-in Admin with a
  // successful read reaches the cards, where empty honestly means "no
  // services configured" — not "could not read services".
  if (read.status === "loading") {
    return <LoadingState text="Loading services..." testId="services-loading" />;
  }
  if (read.status === "unauthorized") {
    return (
      <ErrorState
        title="Could not read services — access denied."
        message={read.message}
        testId="services-unauthorized"
      />
    );
  }
  if (read.status === "error") {
    return (
      <ErrorState
        title="Could not read services — unexpected database error."
        message={read.message}
        testId="services-error"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="primary">
          + Add Service
        </Button>
      </div>

      {rowError && (
        <ErrorState title="Could not update service" message={rowError} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {services.length === 0 && (
          <div className="col-span-full" data-testid="services-empty">
            <EmptyState
              heading="No services configured yet"
              body="Add the first garage service above."
            />
          </div>
        )}
        {services.map((s) => (
          <Card key={s.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{s.name}</h3>
              <Badge tone={s.is_available ? "success" : "neutral"}>
                {s.is_available ? "Available" : "Paused"}
              </Badge>
            </div>
            {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
            {s.vehicle_types.length > 0 && (
              <p className="text-xs text-muted-foreground">Vehicle types: {s.vehicle_types.join(", ")}</p>
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
                <Button variant="destructive" onClick={() => { setPendingDelete(s); setDeleteError(null); }}>
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
            <div role="alert" className="p-3 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <FormField label="Service name" htmlFor="service-name">
              <Input
                id="service-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Description" htmlFor="service-description">
              <Textarea
                id="service-description"
                rows={3}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>
            <FormField
              label="Vehicle types"
              htmlFor="service-vehicles"
              hint="Comma separated (e.g. sedan, SUV, truck)"
            >
              <Input
                id="service-vehicles"
                value={vehicleTypesText}
                onChange={(e) => setVehicleTypesText(e.target.value)}
              />
            </FormField>
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
              <Button type="submit" variant="primary" loading={saving} disabled={saving}>
                Save Service
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
        title="Remove service"
        description={
          pendingDelete
            ? `Remove "${pendingDelete.name}" permanently? Consider toggling availability off instead — removal cannot be undone.`
            : "Remove this service permanently?"
        }
        confirmLabel="Remove service"
        destructive
        error={deleteError}
        onConfirm={confirmDelete}
        testId="confirm-delete-service"
      />
    </div>
  );
}
