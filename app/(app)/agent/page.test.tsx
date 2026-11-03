// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getFunctionName } from "convex/server";
import type { AgentMarket } from "@/lib/agent-intent";
import AgentPage from "./page";

const mocks = vi.hoisted(() => ({
  account: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  resolveIntent: vi.fn(),
  push: vi.fn(),
  sendForm: vi.fn((_props: unknown) => null),
}));

const markets: AgentMarket[] = [
  { coin: "BTC", symbol: "BTC", name: "BTC", keywords: [] },
  { coin: "xyz:TSLA", symbol: "TSLA", name: "Tesla", keywords: ["tesla"] },
  { coin: "xyz:NVDA", symbol: "NVDA", name: "Nvidia", keywords: ["nvidia"] },
];

vi.mock("@/lib/use-signed-in-wallet", () => ({
  useSignedInWallet: () => ({ ready: true, isSignedIn: true, address: mocks.account }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("convex/react", () => ({
  useQuery: () => [{ name: "Marco", address: "0x0000000000000000000000000000000000000001" }],
  useAction: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "agent:resolveIntent") return mocks.resolveIntent;
    throw new Error(`Unexpected action: ${name}`);
  },
}));
vi.mock("@/components/trade/use-hyperliquid", () => ({ useMarkets: () => ({ data: markets }) }));
vi.mock("@/components/agent-mascot", () => ({ AgentMascot: () => null }));
vi.mock("@/components/create-request-form", () => ({ CreateRequestForm: () => null }));
vi.mock("@/components/send-form", () => ({ SendForm: mocks.sendForm }));
vi.mock("@/components/login-button", () => ({ LoginButton: () => null }));
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

function submit(prompt: string) {
  render(<AgentPage />);
  fireEvent.change(screen.getByLabelText("Your intent"), { target: { value: prompt } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe("agent trade intents", () => {
  it("opens the market with side, amount and leverage prefilled", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "trade_long" });
    submit("Long Tesla with $50 at 5x");
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/trade/xyz%3ATSLA?side=long&amount=50&leverage=5"),
    );
  });

  it("asks which market when none is named, then opens the choice", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "trade_short" });
    submit("Short something with $20");
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /NVDA/ }));
    expect(mocks.push).toHaveBeenCalledWith("/trade/xyz%3ANVDA?side=short&amount=20");
  });
});

describe("agent send intents", () => {
  it("prefills the send form with the named contact and amount", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "send" });
    submit("Send 100 USDC to Marco");
    await screen.findByRole("dialog");
    expect(mocks.sendForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: { address: "0x0000000000000000000000000000000000000001", amount: "100" },
      }),
      undefined,
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offers a choice when the model is unsure", async () => {
    mocks.resolveIntent.mockResolvedValue({
      status: "choose",
      probabilities: { send: 0.4, trade_long: 0.5, unsupported: 0.1 },
    });
    submit("do the thing");
    await screen.findByText("Which operation did you mean?");
    expect(screen.getByRole("button", { name: /Go long/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send USDC/ })).toBeTruthy();
  });
});
