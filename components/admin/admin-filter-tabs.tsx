"use client";

import { cn } from "@/lib/ui/cn";

// ONE filter-tab pattern for admin queues (design contract, F-03):
// active tab is solid navy, inactive tabs are card surfaces.
export function AdminFilterTabs<T extends string>({
  options,
  value,
  onChange,
  formatLabel,
  testIdPrefix,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  testIdPrefix?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="tablist">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={testIdPrefix ? `${testIdPrefix}${option}` : undefined}
            onClick={() => onChange(option)}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-none transition-colors uppercase",
              active ? "bg-navy text-white" : "bg-card text-navy hover:bg-muted",
            )}
          >
            {(formatLabel ?? ((v: T) => v.replace(/_/g, " ")))(option)}
          </button>
        );
      })}
    </div>
  );
}
