import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.01em] transition-[color,background-color,border-color,opacity] duration-[var(--duration)] ease-[var(--ease-out)] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] motion-safe:transition-[color,background-color,border-color,opacity,scale] motion-safe:duration-[160ms]",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover",
        secondary: "border border-border-strong bg-panel-elevated text-foreground hover:bg-panel",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-panel",
        ghost: "text-foreground hover:bg-foreground/5 active:bg-foreground/10",
        destructive: "bg-danger text-danger-ink hover:bg-danger/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "size-11",
        "icon-sm":
          "relative size-8 rounded-md after:absolute after:inset-[min(0px,calc((100%_-_44px)/2))] after:content-['']",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
