import * as React from "react";
import { cn } from "@/lib/ui/cn";

// ONE loading pattern (design contract §17): spinner + optional text.
// Page-level loads render this; no plain-text-only loaders.
export function LoadingState({
  text,
  testId,
  className,
}: {
  text?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center py-16", className)} data-testid={testId}>
      <div
        className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"
        aria-hidden="true"
      />
      {text ? (
        <p className="text-sm text-muted-foreground mt-2">{text}</p>
      ) : null}
    </div>
  );
}
