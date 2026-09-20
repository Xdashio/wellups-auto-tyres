import * as React from "react";
import { cn } from "@/lib/ui/cn";

type BadgeTone = "info" | "success" | "warning" | "error" | "neutral";

const tones: Record<BadgeTone, string> = {
  info: "bg-blue-muted/15 text-navy",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  neutral: "bg-text-secondary/15 text-text-primary",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
