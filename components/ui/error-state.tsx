import * as React from "react";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/ui/button";

// Reusable error presentation (design contract §15): role="alert",
// plain-language message, optional retry. Never exposes SQL internals —
// callers pass a safe message, never error.stack or query text.
export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  testId,
  className,
}: {
  title: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  testId?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn(
        "p-4 bg-destructive/10 border border-destructive/20 rounded-none space-y-1",
        className,
      )}
    >
      <p className="text-sm font-semibold text-destructive">{title}</p>
      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
      {onRetry ? (
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel ?? "Try again"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
