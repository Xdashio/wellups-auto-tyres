import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/ui/cn";

export function Separator({ className, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn("bg-text-secondary/30 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full", className)}
      {...props}
    />
  );
}
