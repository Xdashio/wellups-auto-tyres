"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// Reusable confirmation pattern (design contract §13): title,
// description, destructive/normal action, cancel, loading, error.
// Replaces every native confirm()/alert() product flow.
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  error = null,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  testId?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const running = loading || busy;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={testId} aria-describedby={undefined}>
        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error ? (
          <div
            role="alert"
            className="p-3 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={running}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={running}
            disabled={running}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
