import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/ui/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-md text-sm font-medium no-underline transition-colors";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-secondary/15 text-navy hover:bg-secondary/25",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted",
  ghost: "text-navy hover:bg-blue-muted/15",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 min-h-9 min-w-9 px-3 text-xs",
  md: "h-11 min-h-11 px-4 py-2",
  lg: "h-12 min-h-12 px-5 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  asChild,
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  // When `asChild`, Radix Slot must receive exactly one element child to clone.
  // Rendering the spinner as a sibling would turn `children` into an array
  // (e.g. [null, <Link>]) and Slot throws "failed to slot onto its children".
  // Only real <button> elements may carry the spinner + children as siblings.
  if (asChild) {
    return (
      <Comp
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
