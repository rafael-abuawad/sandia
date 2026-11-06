// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsdcBalanceCard } from "./usdc-balance-card";

const mocks = vi.hoisted(() => ({
  wallet: vi.fn(),
  account: vi.fn(),
}));
vi.mock("@/lib/use-signed-in-wallet", () => ({ useSignedInWallet: mocks.wallet }));
vi.mock("@/lib/stellar/use-account", () => ({ useStellarAccount: mocks.account }));
vi.mock("next/image", () => ({ default: () => null }));

beforeEach(() => {
  mocks.wallet.mockReturnValue({
    address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    isConnected: true,
  });
  mocks.account.mockReturnValue({ data: { usdcBalance: 20_000_000n }, isError: false });
});
afterEach(cleanup);

describe("UsdcBalanceCard", () => {
  it("shows the wallet balance, in 7 decimals", () => {
    render(<UsdcBalanceCard />);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Available to send")).toBeTruthy();
  });

  it("shows when the balance can't be read", () => {
    mocks.account.mockReturnValue({ data: undefined, isError: true });
    render(<UsdcBalanceCard />);
    expect(screen.getByText("Balance unavailable")).toBeTruthy();
  });

  it("asks to connect when signed out", () => {
    mocks.wallet.mockReturnValue({ address: undefined, isConnected: false });
    mocks.account.mockReturnValue({ data: undefined, isError: false });
    render(<UsdcBalanceCard />);
    expect(screen.getByText("Connect to view balance")).toBeTruthy();
  });
});
