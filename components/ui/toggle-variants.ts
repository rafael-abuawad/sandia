import { cva } from "class-variance-authority";

export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition-[color,background-color,border-color] duration-[var(--duration)] ease-[var(--ease-out)] outline-none hover:bg-foreground/5 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-border-strong data-[state=on]:bg-foreground/5 data-[state=on]:text-foreground data-[state=on]:hover:bg-foreground/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-panel",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-3 text-xs",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
