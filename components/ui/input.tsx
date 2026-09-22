import * as React from "react";
import { cn } from "@/lib/ui/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  isError?: boolean;
}

export function Input({ className, type, isError, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "w-full min-h-11 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground",
        "placeholder-muted-foreground/60 transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-disabled/50",
        isError ? "border-destructive" : "",
        className,
      )}
      {...props}
    />
  );
}
