import * as React from "react";
import { cn } from "@/lib/ui/cn";

// Consistent empty-state system (design contract §14). EMPTY is neutral
// and honest; it is never used for unauthorized or error outcomes.
export function EmptyState({
  heading,
  body,
  action,
  testId,
  className,
}: {
  heading: string;
  body?: string;
  action?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "text-center py-16 px-6 border border-border rounded-none bg-blue-muted/10 space-y-4",
        className,
      )}
    >
      <p className="text-lg font-semibold">{heading}</p>
      {body ? (
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">{body}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
