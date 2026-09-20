import * as React from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-text-secondary/25 bg-white p-4", className)}
      {...props}
    />
  );
}
