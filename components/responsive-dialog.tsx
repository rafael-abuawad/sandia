"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

export function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = false,
}: {
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerContent className={className}>{children}</DrawerContent>;
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerHeader className={className}>{children}</DrawerHeader>;
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerFooter className={className}>{children}</DrawerFooter>;
  return <DialogFooter className={className}>{children}</DialogFooter>;
}

export function ResponsiveDialogTitle({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerTitle>{children}</DrawerTitle>;
  return <DialogTitle>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) return <DrawerDescription>{children}</DrawerDescription>;
  return <DialogDescription>{children}</DialogDescription>;
}

export function ResponsiveDialogClose({
  render,
  children,
}: {
  render: React.ReactElement;
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerClose render={render}>{children}</DrawerClose>;
  }
  return <DialogClose render={render}>{children}</DialogClose>;
}

export function ResponsiveDialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <div className={isMobile ? `flex-1 overflow-y-auto px-5 pb-2 ${className ?? ""}` : className}>
      {children}
    </div>
  );
}
