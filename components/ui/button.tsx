import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.01em] transition-[color,background-color,border-color,transform,opacity] duration-[var(--duration)] ease-[var(--ease-out)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-ink hover:bg-accent-hover",
        secondary: "border border-border-strong bg-panel-elevated text-foreground hover:bg-panel",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-panel",
        ghost: "text-foreground hover:bg-foreground/5",
        destructive: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "size-11",
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

export { buttonVariants };
