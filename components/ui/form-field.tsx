import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Label } from "@/components/ui/label";

// Normalized form field (design contract §9): visible label, control,
// helper text, validation message. Never placeholder-only.
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor ?? "field"}-error` : undefined;
  return (
    <div className={cn("space-y-0", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ "aria-describedby"?: string }>, {
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
          })
        : children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      ) : null}
      {error ? (
        <p id={describedBy} role="alert" className="text-xs text-destructive mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}
