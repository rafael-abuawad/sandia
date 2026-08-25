"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "flex h-11 w-full items-stretch overflow-hidden rounded-md border border-border-strong bg-panel-elevated sm:h-10",
        className,
      )}
      {...props}
    />
  );
}

export const InputGroupInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-subtle outline-none shadow-none focus-visible:outline-none focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
InputGroupInput.displayName = "InputGroupInput";

export function InputGroupAddon({
  className,
  align = "inline-end",
  ...props
}: React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" }) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center",
        align === "inline-start" && "order-first pl-1",
        align === "inline-end" && "order-last pr-1",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupButton({
  className,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("shrink-0 rounded-md", className)}
      {...props}
    />
  );
}
