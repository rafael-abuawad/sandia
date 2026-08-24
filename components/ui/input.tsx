import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-md border border-border-strong bg-panel-elevated px-3 py-2 text-base text-foreground placeholder:text-subtle transition-[border-color] duration-[var(--duration)] ease-[var(--ease-out)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
