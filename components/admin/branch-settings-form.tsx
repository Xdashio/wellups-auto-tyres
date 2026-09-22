"use client";

import React, { useState } from "react";
import { BranchData, BranchSettingsInput, BranchSettingsSchema } from "@/lib/supabase/branch";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BranchSettingsFormProps {
  initialBranch: BranchData;
  onSave: (accessToken: string, input: BranchSettingsInput) => Promise<{ success: boolean; error?: string; data?: BranchData }>;
}

export function BranchSettingsForm({ initialBranch, onSave }: BranchSettingsFormProps) {
  const [formData, setFormData] = useState<BranchSettingsInput>({
    name: initialBranch.name || "",
    address: initialBranch.address || "",
    phone: initialBranch.phone || "",
    whatsapp: initialBranch.whatsapp || "",
    opening_hours: initialBranch.opening_hours || "",
    mpesa_channel_type: initialBranch.mpesa_channel_type || null,
    mpesa_paybill_number: initialBranch.mpesa_paybill_number || "",
    mpesa_till_number: initialBranch.mpesa_till_number || "",
    mpesa_account_number: initialBranch.mpesa_account_number || "",
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleChannelToggle = (channel: "paybill" | "till") => {
    setFormData((prev) => ({
      ...prev,
      mpesa_channel_type: prev.mpesa_channel_type === channel ? null : channel,
    }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Client-side Zod validation
    const validation = BranchSettingsSchema.safeParse(formData);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join(", ");
      setErrorMessage(msg);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      if (!accessToken) {
        setErrorMessage("Sign in as a staff member before saving. Settings writes are admin-only.");
        return;
      }
      const res = await onSave(accessToken, validation.data);
      if (res.success) {
        setSuccessMessage("Branch business settings updated successfully!");
        if (res.data) {
          setFormData({
            name: res.data.name || "",
            address: res.data.address || "",
            phone: res.data.phone || "",
            whatsapp: res.data.whatsapp || "",
            opening_hours: res.data.opening_hours || "",
            mpesa_channel_type: res.data.mpesa_channel_type || null,
            mpesa_paybill_number: res.data.mpesa_paybill_number || "",
            mpesa_till_number: res.data.mpesa_till_number || "",
            mpesa_account_number: res.data.mpesa_account_number || "",
          });
        }
      } else {
        setErrorMessage(res.error || "Failed to update branch settings.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Public Business Settings</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage your official branch contact details and public website configuration.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-md bg-success/10 border border-success/20 text-success text-sm font-medium">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium text-navy">
            Branch Name *
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="WELL LUPS AUTO TYRES — Industrial Area"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="whatsapp" className="block text-sm font-medium text-navy">
            WhatsApp Business Number
          </label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="text"
            value={formData.whatsapp || ""}
            onChange={handleChange}
            className="font-mono"
            placeholder="e.g. 254712345678"
          />
          <p className="text-xs text-text-secondary">
            Used to generate "Get a Quote" WhatsApp deep links across product and service pages.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="phone" className="block text-sm font-medium text-navy">
            Phone Number
          </label>
          <Input
            id="phone"
            name="phone"
            type="text"
            value={formData.phone || ""}
            onChange={handleChange}
            placeholder="+254 700 000000"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="address" className="block text-sm font-medium text-navy">
            Physical Address
          </label>
          <Textarea
            id="address"
            name="address"
            rows={2}
            value={formData.address || ""}
            onChange={handleChange}
            placeholder="Industrial Area, Nairobi, Kenya"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="opening_hours" className="block text-sm font-medium text-navy">
            Opening Hours
          </label>
          <Input
            id="opening_hours"
            name="opening_hours"
            type="text"
            value={formData.opening_hours || ""}
            onChange={handleChange}
            placeholder="Mon - Sat: 8:00 AM - 6:00 PM"
          />
        </div>

        <div className="pt-4 border-t space-y-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">M-Pesa Payment Channel</h3>
            <p className="text-xs text-text-secondary mt-1">
              Only one channel is ever live at a time. Toggle which one is active — the
              inactive number stays saved here but is never shown to customers.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={formData.mpesa_channel_type === "paybill" ? "primary" : "secondary"}
              onClick={() => handleChannelToggle("paybill")}
            >
              Paybill {formData.mpesa_channel_type === "paybill" ? "(Active)" : ""}
            </Button>
            <Button
              type="button"
              variant={formData.mpesa_channel_type === "till" ? "primary" : "secondary"}
              onClick={() => handleChannelToggle("till")}
            >
              Till {formData.mpesa_channel_type === "till" ? "(Active)" : ""}
            </Button>
          </div>

          <div className="space-y-1">
            <label htmlFor="mpesa_paybill_number" className="block text-sm font-medium text-navy">
              Paybill Number
            </label>
            <Input
              id="mpesa_paybill_number"
              name="mpesa_paybill_number"
              type="text"
              value={formData.mpesa_paybill_number || ""}
              onChange={handleChange}
              className="font-mono"
              placeholder="e.g. 400200"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="mpesa_account_number" className="block text-sm font-medium text-navy">
              Paybill Account Number
            </label>
            <Input
              id="mpesa_account_number"
              name="mpesa_account_number"
              type="text"
              value={formData.mpesa_account_number || ""}
              onChange={handleChange}
              className="font-mono"
              placeholder="Only needed if using Paybill"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="mpesa_till_number" className="block text-sm font-medium text-navy">
              Till Number
            </label>
            <Input
              id="mpesa_till_number"
              name="mpesa_till_number"
              type="text"
              value={formData.mpesa_till_number || ""}
              onChange={handleChange}
              className="font-mono"
              placeholder="e.g. 123456"
            />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <Button type="submit" disabled={loading} variant="primary">
            {loading ? "Saving Settings..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
