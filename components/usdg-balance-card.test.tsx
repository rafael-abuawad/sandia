// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VAULT_ADDRESS } from "@/lib/vault-calls";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { UsdgBalanceCard } from "./usdg-balance-card";

const mocks = vi.hoisted(() => ({
  wallet: vi.fn(),
  read: vi.fn(),
  walletResult: { data: 2_000_000n as bigint | undefined, isError: false },
  sharesResult: { data: 10_000_000n as bigint | undefined, isError: false },
  assetsResult: { data: 10_500_000n as bigint | undefined, isError: false },
}));
vi.mock("@/lib/use-signed-in-wallet", () => ({ useSignedInWallet: mocks.wallet }));
vi.mock("wagmi", () => ({ useReadContract: mocks.read }));
vi.mock("next/image", () => ({ default: () => null }));

beforeEach(() => {
  mocks.wallet.mockReturnValue({
    address: "0x1111111111111111111111111111111111111111",
    isConnected: true,
  });
  mocks.walletResult = { data: 2_000_000n, isError: false };
  mocks.sharesResult = { data: 10_000_000n, isError: false };
  mocks.assetsResult = { data: 10_500_000n, isError: false };
  mocks.read.mockReset();
  mocks.read.mockImplementation(({ address, functionName }) =>
    functionName === "convertToAssets"
      ? mocks.assetsResult
      : address === VAULT_ADDRESS
        ? mocks.sharesResult
        : mocks.walletResult,
  );
});
afterEach(cleanup);

function expand() {
  fireEvent.click(screen.getByRole("button", { name: "Show USDG balance breakdown" }));
}

function row(label: string) {
  return within(screen.getByText(label).parentElement!);
}

describe("USDG balance card", () => {
  it("adds wallet assets to the vault's asset value and toggles the breakdown", () => {
    render(<UsdgBalanceCard />);
    const toggle = screen.getByRole("button", { name: "Show USDG balance breakdown" });
    expect(within(toggle).getByText("12.5")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const breakdown = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(breakdown?.hidden).toBe(true);
    expand();
    expect(breakdown?.hidden).toBe(false);
    expect(row("Wallet USDG").getByText("2")).toBeTruthy();
    expect(row("Steakhouse vault").getByText("10.5")).toBeTruthy();
    expect(mocks.read).toHaveBeenCalledWith(
      expect.objectContaining({
        address: VAULT_ADDRESS,
        functionName: "convertToAssets",
        args: [10_000_000n],
        chainId: ROBINHOOD_USDG.chainId,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide USDG balance breakdown" }));
    expect(breakdown?.hidden).toBe(true);
  });

  it("handles zero shares without waiting for a conversion", () => {
    mocks.sharesResult.data = 0n;
    mocks.assetsResult.data = undefined;
    render(<UsdgBalanceCard />);
    expect(within(screen.getByRole("button")).getByText("2")).toBeTruthy();
    expand();
    expect(row("Steakhouse vault").getByText("0")).toBeTruthy();
    expect(
      mocks.read.mock.calls.find(([args]) => args.functionName === "convertToAssets")?.[0].query
        .enabled,
    ).toBe(false);
  });

  it("waits for the vault read before presenting the combined total", () => {
    mocks.sharesResult.data = undefined;
    mocks.assetsResult.data = undefined;
    render(<UsdgBalanceCard />);
    expect(within(screen.getByRole("button")).getByText("…")).toBeTruthy();
    expand();
    expect(row("Wallet USDG").getByText("2")).toBeTruthy();
    expect(row("Steakhouse vault").getByText("…")).toBeTruthy();
  });

  it.each(["walletResult", "sharesResult", "assetsResult"] as const)(
    "does not display a partial total when %s fails",
    (result) => {
      mocks[result].isError = true;
      render(<UsdgBalanceCard />);
      expect(within(screen.getByRole("button")).getByText("—")).toBeTruthy();
      expect(screen.getByText("Balance unavailable")).toBeTruthy();
      expand();
      expect(
        row(result === "walletResult" ? "Wallet USDG" : "Steakhouse vault").getByText("—"),
      ).toBeTruthy();
    },
  );

  it("disables reads and hides cached balances after disconnecting", () => {
    const view = render(<UsdgBalanceCard />);
    mocks.wallet.mockReturnValue({ address: undefined, isConnected: false });
    view.rerender(<UsdgBalanceCard />);
    expect(within(screen.getByRole("button")).getByText("—")).toBeTruthy();
    expect(screen.getByText("Connect to view balance")).toBeTruthy();
    expand();
    expect(row("Wallet USDG").getByText("—")).toBeTruthy();
    expect(row("Steakhouse vault").getByText("—")).toBeTruthy();
    for (const [args] of mocks.read.mock.calls.slice(-3)) {
      expect(args.query.enabled).toBe(false);
    }
  });
});
