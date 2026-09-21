"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/ui/cn";

// ─── Root ──────────────────────────────────────────────────────────────────
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

// ─── Trigger ───────────────────────────────────────────────────────────────
export interface SelectTriggerProps
  extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  /** Visual size variant — matches Input height at "md" (default). */
  size?: "sm" | "md";
  /** Highlight in rose to indicate validation error. */
  isError?: boolean;
}

export function SelectTrigger({
  className,
  children,
  size = "md",
  isError = false,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        // Layout & shape — mirrors Input
        "inline-flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2",
        "text-sm text-text-primary",
        // Height — matches Input (min-h-11) at md, compact at sm
        size === "md" ? "min-h-11" : "min-h-8 text-xs",
        // Border colour
        isError
          ? "border-rose-400 ring-1 ring-rose-300"
          : "border-text-secondary/40",
        // Focus ring
        "outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Placeholder text colour via data-placeholder attribute
        "[&[data-placeholder]>span]:text-text-secondary",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon
          className="h-4 w-4 shrink-0 text-text-secondary transition-transform duration-150 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

// ─── Content (dropdown panel) ───────────────────────────────────────────────
export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={4}
        className={cn(
          // Shape & shadow
          "relative z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-text-secondary/20 bg-white shadow-lg",
          // Animation in
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          // Animation out
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          // Slide direction based on side
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          // Popper width alignment
          position === "popper" && "w-full",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

// ─── Scroll buttons ─────────────────────────────────────────────────────────
export function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        "flex cursor-default items-center justify-center py-1 text-text-secondary",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

export function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        "flex cursor-default items-center justify-center py-1 text-text-secondary",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

// ─── Label ──────────────────────────────────────────────────────────────────
export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        "px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}

// ─── Item ───────────────────────────────────────────────────────────────────
export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        // Base
        "relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm text-text-primary outline-none",
        // Hover / focus highlight using system blue-muted
        "focus:bg-blue-muted/15 focus:text-navy",
        // Selected item
        "data-[state=checked]:font-medium data-[state=checked]:text-navy",
        // Disabled
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      {/* Check indicator — left-aligned */}
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="h-3.5 w-3.5 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

// ─── Separator ──────────────────────────────────────────────────────────────
export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-text-secondary/10", className)}
      {...props}
    />
  );
}
