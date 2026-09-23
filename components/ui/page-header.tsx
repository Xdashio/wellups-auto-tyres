import * as React from "react";
import { cn } from "@/lib/ui/cn";

// Single page-heading pattern (design contract §3): listing and admin
// pages use the default 3xl variant; detail/transactional pages use the
// compact 2xl variant. Never hand-roll another h1 treatment.
export function PageHeader({
  title,
  description,
  actions,
  size = "default",
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: "default" | "compact";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-border pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4",
        className,
      )}
    >
      <div>
        <h1
          className={
            size === "compact"
              ? "text-2xl font-extrabold tracking-tight"
              : "text-3xl font-extrabold tracking-tight"
          }
        >
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
