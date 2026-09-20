import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/ui/cn";

export function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />;
}

export function SelectTrigger({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn("inline-flex min-h-11 items-center justify-between rounded-md border border-text-secondary/40 bg-white px-3 py-2 text-sm", className)}
      {...props}
    />
  );
}

export function SelectItem({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn("px-3 py-2 text-sm outline-none focus:bg-blue-muted/15", className)}
      {...props}
    />
  );
}

export const SelectContent = SelectPrimitive.Content;
export const SelectValue = SelectPrimitive.Value;
