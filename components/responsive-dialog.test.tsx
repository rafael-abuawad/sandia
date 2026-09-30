// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "./responsive-dialog";

const mocks = vi.hoisted(() => ({ useIsMobile: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mocks.useIsMobile }));

beforeEach(() => {
  mocks.useIsMobile.mockReset();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TestDialog() {
  return (
    <ResponsiveDialog open onOpenChange={() => undefined}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Deposit into Earn</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Review the deposit.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>Vault details</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

describe("responsive dialog", () => {
  it("shares the root viewport choice with every part during a breakpoint change", () => {
    mocks.useIsMobile.mockReturnValueOnce(false).mockReturnValue(true);
    render(<TestDialog />);
    expect(screen.getByRole("dialog", { name: "Deposit into Earn" })).toBeTruthy();
    expect(mocks.useIsMobile).toHaveBeenCalledTimes(1);
  });

  it("renders the mobile drawer with matching parts", () => {
    mocks.useIsMobile.mockReturnValue(true);
    render(<TestDialog />);
    expect(screen.getByRole("dialog", { name: "Deposit into Earn" })).toBeTruthy();
    expect(mocks.useIsMobile).toHaveBeenCalledTimes(1);
  });
});
