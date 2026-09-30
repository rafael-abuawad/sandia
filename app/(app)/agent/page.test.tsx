// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getFunctionName } from "convex/server";
import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { VAULT_ADDRESS, vaultAbi } from "@/lib/vault-calls";
import type { AgentStock } from "@/lib/agent-intent";
import AgentPage from "./page";

const mocks = vi.hoisted(() => ({
  account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  hash: `0x${"a".repeat(64)}` as const,
  resolveIntent: vi.fn(),
  readSnapshot: vi.fn(),
  record: vi.fn(),
  confirm: vi.fn(),
  sendTransaction: vi.fn(),
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  refetch: vi.fn(),
  stockTradeTicket: vi.fn(() => null),
  balance: 100_000_000n,
  depositsOpen: true,
  snapshot: {
    isPending: false,
    isError: false,
    data: {
      ok: true,
      netApy: 0.0369,
      totalAssetsUsd: 510_190_000,
      liquidityUsd: 38_120_000,
      exposure: [],
    },
  },
}));

const stockCatalog: AgentStock[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA • Robinhood Token",
    shortName: "NVIDIA",
    contractAddress: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    tokenDecimals: 18,
  },
  {
    symbol: "P",
    name: "Everpure • Robinhood Token",
    shortName: "Everpure",
    contractAddress: "0x1Cdad396DB64BDa184d5182A97Dd9B3C62100b7D",
    tokenDecimals: 18,
  },
];

vi.mock("@/lib/use-signed-in-wallet", () => ({
  useSignedInWallet: () => ({ ready: true, isSignedIn: true, address: mocks.account }),
}));
vi.mock("convex/react", () => ({
  useQuery: () => [],
  useAction: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "agent:resolveIntent") return mocks.resolveIntent;
    if (name === "vault:readSnapshot") return mocks.readSnapshot;
    if (name === "vaultActivityActions:confirm") return mocks.confirm;
    throw new Error(`Unexpected action: ${name}`);
  },
  useMutation: () => mocks.record,
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => mocks.snapshot }));
vi.mock("@privy-io/react-auth", () => ({
  useSendTransaction: () => ({ sendTransaction: mocks.sendTransaction }),
}));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    readContract: mocks.readContract,
    simulateContract: mocks.simulateContract,
    waitForTransactionReceipt: mocks.waitForTransactionReceipt,
  }),
  useReadContract: ({ address, functionName }: { address: string; functionName: string }) => ({
    data:
      functionName === "balanceOf"
        ? address.toLowerCase() === VAULT_ADDRESS.toLowerCase()
          ? 8_000_000n
          : mocks.balance
        : functionName === "convertToAssets"
          ? 10_000_000n
          : mocks.depositsOpen,
    isError: false,
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));
vi.mock("@/components/agent-mascot", () => ({ AgentMascot: () => null }));
vi.mock("@/components/stocks/stock-detail", () => ({ StockTradeTicket: mocks.stockTradeTicket }));
vi.mock("@/components/create-request-form", () => ({ CreateRequestForm: () => null }));
vi.mock("@/components/send-form", () => ({ SendForm: () => null }));
vi.mock("@/components/login-button", () => ({ LoginButton: () => null }));
vi.mock("@/components/token-chain-select", () => ({
  TokenChainChip: () => <span>Steakhouse · Robinhood Chain</span>,
}));
vi.mock("@/components/responsive-dialog", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    ResponsiveDialogBody: Container,
    ResponsiveDialogContent: Container,
    ResponsiveDialogFooter: Container,
    ResponsiveDialogHeader: Container,
    ResponsiveDialogTitle: Container,
    ResponsiveDialogDescription: Container,
  };
});

async function openOperation(amount = "20", action = "earn_deposit") {
  mocks.resolveIntent.mockResolvedValue({ status: "resolved", action });
  render(<AgentPage />);
  fireEvent.change(screen.getByLabelText("Your intent"), {
    target: { value: `Deposit ${amount} USDG to earn` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("dialog");
  await screen.findByDisplayValue(amount);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.balance = 100_000_000n;
  mocks.depositsOpen = true;
  mocks.snapshot.isPending = false;
  mocks.snapshot.isError = false;
  mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "earn_deposit" });
  mocks.readContract.mockResolvedValue(0n);
  mocks.simulateContract.mockResolvedValue({});
  mocks.sendTransaction.mockResolvedValue({ hash: mocks.hash });
  mocks.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  mocks.refetch.mockResolvedValue({});
  mocks.record.mockResolvedValue("activity-id");
  mocks.confirm.mockResolvedValue({ status: "filled" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/rhj/assets")
        return { ok: true, json: async () => ({ assets: stockCatalog }) };
      if (url.startsWith("/api/rhj/prices?"))
        return { ok: true, json: async () => ({ quote: { isTradingHalt: false } }) };
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("agent stock selection", () => {
  it.each(["NVIDIA", "NVDA", "NVDIA"])(
    "opens the trade ticket for %s with 1 USDG prefilled",
    async (stock) => {
      mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "stock_buy" });
      render(<AgentPage />);
      fireEvent.change(screen.getByLabelText("Your intent"), {
        target: { value: `Swap 1 USDG to ${stock}` },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      await screen.findByRole("dialog");
      expect(screen.queryByLabelText("Choose a Robinhood stock token")).toBeNull();
      expect(screen.getByText("NVDA")).toBeTruthy();
      expect(mocks.stockTradeTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: stockCatalog[0],
          ticketAmount: "1",
          unit: "usd",
          side: "buy",
          embeddedPresentation: true,
        }),
        undefined,
      );
      expect(mocks.sendTransaction).not.toHaveBeenCalled();
    },
  );

  it("keeps manual selection for an unknown stock", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "stock_buy" });
    render(<AgentPage />);
    fireEvent.change(screen.getByLabelText("Your intent"), {
      target: { value: "Swap 1 USDG to an unknown stock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Choose a Robinhood stock token")).toBeTruthy();
    expect(mocks.stockTradeTicket).not.toHaveBeenCalled();
  });
});

describe("agent vault operations", () => {
  it("starts a deposit in the dialog with the requested amount and vault stats", async () => {
    await openOperation();
    expect(screen.getByDisplayValue("20")).toBeTruthy();
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Deposit on Earn" })).toBeNull();
    expect(screen.getByText("Net APY")).toBeTruthy();
    expect(screen.getByText("3.69%")).toBeTruthy();
    expect(screen.getByText("$510.19M")).toBeTruthy();
    expect(screen.getByText("$38.12M")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    await screen.findByText("Deposit confirmed.", { exact: false });

    expect(mocks.sendTransaction).toHaveBeenCalledTimes(2);
    const [approval, deposit] = mocks.sendTransaction.mock.calls.map(
      ([transaction]) => transaction,
    );
    expect(approval.to.toLowerCase()).toBe(ROBINHOOD_USDG.address.toLowerCase());
    expect(decodeFunctionData({ abi: erc20Abi, data: approval.data })).toMatchObject({
      functionName: "approve",
      args: [VAULT_ADDRESS, 20_000_000n],
    });
    expect(deposit.to).toBe(VAULT_ADDRESS);
    expect(decodeFunctionData({ abi: vaultAbi, data: deposit.data })).toMatchObject({
      functionName: "deposit",
      args: [20_000_000n, getAddress(mocks.account)],
    });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "deposit", assets: "20000000", userOpHash: mocks.hash }),
    );
  });

  it("waits for approval confirmation and prevents duplicate submission and closing", async () => {
    let confirmApproval!: (receipt: { status: string }) => void;
    mocks.waitForTransactionReceipt.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirmApproval = resolve;
        }),
    );
    await openOperation();
    const deposit = screen.getByRole("button", { name: "Deposit" });
    fireEvent.click(deposit);
    fireEvent.click(deposit);
    await waitFor(() => expect(mocks.waitForTransactionReceipt).toHaveBeenCalledTimes(1));

    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.simulateContract).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("20").closest("fieldset")?.disabled).toBe(true);
    const close = screen.getByRole("button", { name: "Operation in progress…" });
    expect((close as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(close);
    expect(screen.getByRole("dialog")).toBeTruthy();

    confirmApproval({ status: "success" });
    await screen.findByText("Deposit confirmed.", { exact: false });
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(2);
    expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("uses the edited amount and skips approval when the allowance is sufficient", async () => {
    mocks.readContract.mockResolvedValue(100_000_000n);
    await openOperation();
    fireEvent.change(screen.getByDisplayValue("20"), { target: { value: "25.123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    await screen.findByText("Deposit confirmed.", { exact: false });
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "deposit",
        args: [25_123_456n, getAddress(mocks.account)],
      }),
    );
  });

  it("blocks deposits above the wallet balance", async () => {
    mocks.balance = 10_000_000n;
    await openOperation();
    expect((screen.getByRole("button", { name: "Deposit" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      screen.getByText("This wallet doesn't have enough USDG on Robinhood Chain."),
    ).toBeTruthy();
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });

  it("blocks deposits when the vault is closed", async () => {
    mocks.depositsOpen = false;
    await openOperation();
    expect(
      (screen.getByRole("button", { name: "Deposit unavailable" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mocks.sendTransaction).not.toHaveBeenCalled();
  });

  it("preserves the amount and unlocks the dialog after wallet rejection", async () => {
    mocks.sendTransaction.mockRejectedValueOnce(new Error("User rejected the request"));
    await openOperation();
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect(screen.getByDisplayValue("20")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Deposit" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(mocks.simulateContract).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not submit a deposit after a failed approval", async () => {
    mocks.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
    await openOperation();
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    await screen.findByText("USDG approval did not confirm. Try again.");
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.simulateContract).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("uses the withdrawal intent and redeems the full position in the dialog", async () => {
    await openOperation("10", "earn_withdraw");
    expect(screen.queryByRole("button", { name: "Deposit" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
    await screen.findByText("Redemption confirmed.", { exact: false });
    expect(mocks.sendTransaction).toHaveBeenCalledTimes(1);
    expect(
      decodeFunctionData({ abi: vaultAbi, data: mocks.sendTransaction.mock.calls[0][0].data }),
    ).toMatchObject({
      functionName: "redeem",
      args: [8_000_000n, getAddress(mocks.account), getAddress(mocks.account)],
    });
  });
});
