import * as React from "react";
import { cn } from "@/lib/ui/cn";

type BadgeTone =
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "outline";

const tones: Record<BadgeTone, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary/15 text-navy",
  info: "bg-secondary/10 text-navy",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  outline: "border border-border text-muted-foreground bg-transparent",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}