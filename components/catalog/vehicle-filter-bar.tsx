"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PublicVehicleFitment } from "@/lib/supabase/catalog";

interface VehicleFilterBarProps {
  fitments: PublicVehicleFitment[];
}

export function VehicleFilterBar({ fitments }: VehicleFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedTrim, setSelectedTrim] = useState<string>("");

  const makes = useMemo(() => {
    const set = new Set<string>();
    fitments.forEach((f) => set.add(f.make_name));
    return Array.from(set).sort();
  }, [fitments]);

  const models = useMemo(() => {
    if (!selectedMake) return [];
    const set = new Set<string>();
    fitments
      .filter((f) => f.make_name === selectedMake)
      .forEach((f) => set.add(f.model_name));
    return Array.from(set).sort();
  }, [fitments, selectedMake]);

  const trims = useMemo(() => {
    if (!selectedModel) return [];
    return fitments.filter(
      (f) => f.make_name === selectedMake && f.model_name === selectedModel
    );
  }, [fitments, selectedMake, selectedModel]);

  const handleApplyFilter = () => {
    if (!selectedTrim) return;
    const targetFitment = fitments.find((f) => f.trim_id === selectedTrim);
    if (targetFitment) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sizeSpec", targetFitment.tyre_size_spec);
      router.push(`/products?${params.toString()}`);
    }
  };

  const handleClear = () => {
    setSelectedMake("");
    setSelectedModel("");
    setSelectedTrim("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sizeSpec");
    router.push(`/products?${params.toString()}`);
  };

  return (
    <div className="bg-blue-muted/10 p-4 rounded-none border border-blue-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-navy">
          Filter by Vehicle (Kenya Catalogue)
        </h2>
        {searchParams.get("sizeSpec") && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-mono font-medium">
            Active Size: {searchParams.get("sizeSpec")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Select value={selectedMake} onValueChange={(val) => {
          setSelectedMake(val);
          setSelectedModel("");
          setSelectedTrim("");
        }}>
          <SelectTrigger aria-label="Vehicle make">
            <SelectValue placeholder="Select Make" />
          </SelectTrigger>
          <SelectContent>
            {makes.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={!selectedMake}
          value={selectedModel}
          onValueChange={(val) => {
            setSelectedModel(val);
            setSelectedTrim("");
          }}
        >
          <SelectTrigger aria-label="Vehicle model">
            <SelectValue placeholder={selectedMake ? "Select Model" : "Select Make First"} />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={!selectedModel}
          value={selectedTrim}
          onValueChange={(val) => setSelectedTrim(val)}
        >
          <SelectTrigger aria-label="Vehicle trim and tyre size">
            <SelectValue placeholder={selectedModel ? "Select Trim / Size" : "Select Model First"} />
          </SelectTrigger>
          <SelectContent>
            {trims.map((t) => (
              <SelectItem key={t.fitment_id} value={t.trim_id}>
                {t.trim_name} ({t.tyre_size_spec}) {t.is_verified ? "✓" : "(Pending Verification)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            onClick={handleApplyFilter}
            disabled={!selectedTrim}
            variant="primary"
            className="flex-1"
          >
            Filter
          </Button>
          <Button onClick={handleClear} variant="ghost">
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
