import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-md border border-border-strong bg-panel-elevated px-3 py-2 text-base text-foreground placeholder:text-subtle transition-[border-color] duration-[var(--duration)] ease-[var(--ease-out)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
