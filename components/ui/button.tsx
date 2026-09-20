import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/ui/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-blue-muted/15 text-navy hover:bg-blue-muted/25",
  ghost: "text-navy hover:bg-blue-muted/15",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  asChild?: boolean;
}

export function Button({ variant = "primary", asChild, className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
