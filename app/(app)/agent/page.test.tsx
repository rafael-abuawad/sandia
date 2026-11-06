// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AgentPage from "./page";

const account = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const mocks = vi.hoisted(() => ({
  resolveIntent: vi.fn(),
  sendForm: vi.fn(),
  requestForm: vi.fn(),
}));

vi.mock("@/lib/use-signed-in-wallet", () => ({
  useSignedInWallet: () => ({ ready: true, isSignedIn: true, address: account }),
}));
vi.mock("convex/react", () => ({
  useQuery: () => [{ name: "Marco", address: account }],
  useAction: () => mocks.resolveIntent,
}));
vi.mock("@/components/agent-mascot", () => ({ AgentMascot: () => null }));
vi.mock("@/components/login-button", () => ({ LoginButton: () => null }));
vi.mock("@/components/send-form", () => ({
  SendForm: (props: Record<string, unknown>) => {
    mocks.sendForm(props);
    return <p>Send form</p>;
  },
}));
vi.mock("@/components/create-request-form", () => ({
  CreateRequestForm: (props: Record<string, unknown>) => {
    mocks.requestForm(props);
    return <p>Request form</p>;
  },
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

function submit(prompt: string) {
  render(<AgentPage />);
  fireEvent.change(screen.getByLabelText("Your intent"), { target: { value: prompt } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("agent actions", () => {
  it("only offers examples for operations Sandia supports", () => {
    render(<AgentPage />);
    expect(screen.getByRole("button", { name: "Send 100 USDC to Marco" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /NVIDIA|earn/i })).toBeNull();
  });

  it("prefills a send from the prompt without submitting anything", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "send" });
    submit("Send 100 USDC to Marco");
    await screen.findByText("Send form");
    expect(mocks.sendForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialValues: { address: account, amount: "100" } }),
    );
  });

  it("opens a request with the amount", async () => {
    mocks.resolveIntent.mockResolvedValue({ status: "resolved", action: "request" });
    submit("Request 50 USDC from Olivia");
    await screen.findByText("Request form");
    expect(mocks.requestForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialAmount: "50" }),
    );
  });

  it("offers only known operations when the intent is unclear", async () => {
    mocks.resolveIntent.mockResolvedValue({
      status: "choose",
      probabilities: { send: 0.5, request: 0.4, unsupported: 0.1, earn_deposit: 0.3 },
    });
    submit("Move some USDC");
    await screen.findByText("Which operation did you mean?");
    expect(screen.getByRole("button", { name: /Send USDC/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Create a payment request/ })).toBeTruthy();
    expect(screen.queryByText(/earn/i)).toBeNull();
  });

  it("explains an unsupported request", async () => {
    mocks.resolveIntent.mockResolvedValue({
      status: "unsupported",
      reason: "Try asking to send or request USDC.",
    });
    submit("Deposit 20 USDC to earn");
    await screen.findByText("Try asking to send or request USDC.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
