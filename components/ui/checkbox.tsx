import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/ui/cn";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn("flex h-5 w-5 items-center justify-center rounded-none border border-muted-foreground/60 bg-input", className)}
      {...props}
    />
  );
}
