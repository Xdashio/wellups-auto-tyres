import * as React from "react";
import { cn } from "@/lib/ui/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isError?: boolean;
}

export function Textarea({ className, isError, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full min-h-[100px] rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground",
        "placeholder-muted-foreground/60 transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-disabled/50",
        isError ? "border-destructive" : "",
        className,
      )}
      {...props}
    />
  );
}
