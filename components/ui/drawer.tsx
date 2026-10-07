"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";

export function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

export function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

export function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

export function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

export function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[var(--overlay)] transition-opacity duration-[var(--duration)] ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "flex max-h-[calc(100dvh-6rem)] w-full flex-col rounded-t-[var(--radius-xl)] border border-border bg-panel-elevated pbe-[env(safe-area-inset-bottom)] shadow-md transition-[opacity,translate] duration-[var(--duration)] ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:data-[ending-style]:translate-y-4 motion-safe:data-[starting-style]:translate-y-4",
            className,
          )}
          {...props}
        >
          <div
            aria-hidden
            className="mx-auto mbs-3 mbe-1 h-1 w-10 shrink-0 rounded-full bg-border-strong"
          />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

export function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 px-5 pbs-3 pbe-2 text-start", className)}
      {...props}
    />
  );
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mbs-auto flex flex-col gap-2 px-5 py-4", className)}
      {...props}
    />
  );
}

export function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("pr-display text-lg text-foreground", className)}
      {...props}
    />
  );
}

export function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}
