"use client";

import { useRef, useState } from "react";
import { Trigger as SelectTrigger } from "@radix-ui/react-select";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <Select
      value={theme ?? "light"}
      onValueChange={setTheme}
      onOpenChange={(open) => {
        if (open) setContainer(triggerRef.current?.closest("dialog") ?? null);
      }}
    >
      <SelectTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 text-muted hover:text-foreground"
          aria-label="Choose theme"
          title="Choose theme"
        >
          <Sun className="pr-theme-light size-4" strokeWidth={1.5} aria-hidden />
          <Moon className="pr-theme-dark size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </SelectTrigger>
      <SelectContent container={container} align="end" side="top" aria-label="Theme">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <Icon className="mr-2 size-4" strokeWidth={1.5} aria-hidden />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
