import * as React from "react";
import { cn } from "@/lib/ui/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-text-secondary/40 bg-white px-3 py-2 text-sm text-text-primary",
        className,
      )}
      {...props}
    />
  );
}
