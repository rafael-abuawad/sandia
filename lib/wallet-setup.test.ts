import { describe, expect, it } from "vitest";
import { privyConnectorReady, walletSetupAction } from "./wallet-setup";

describe("walletSetupAction", () => {
  it("waits until wallets are ready", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: false,
        createAttempted: false,
        connectorReady: false,
      }),
    ).toBe("wait");
  });

  it("creates a wallet once when none is connected", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: true,
        createAttempted: false,
        connectorReady: false,
      }),
    ).toBe("create");
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: true,
        createAttempted: true,
        connectorReady: false,
      }),
    ).toBe("wait");
  });

  it("does not activate before the wagmi connector exists", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: true,
        embeddedAddress: "0xabc",
        connectorReady: false,
        createAttempted: false,
      }),
    ).toBe("wait");
  });

  it("activates once the connector is registered", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: true,
        embeddedAddress: "0xAbC",
        activeAddress: "0xdef",
        connectorReady: true,
        createAttempted: true,
      }),
    ).toBe("activate");
  });

  it("is done when the active account is the embedded wallet", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        walletsReady: true,
        embeddedAddress: "0xAbC",
        activeAddress: "0xabc",
        connectorReady: true,
        createAttempted: true,
      }),
    ).toBe("done");
  });
});

describe("privyConnectorReady", () => {
  it("matches a connector id that contains the wallet address", () => {
    expect(privyConnectorReady(["io.privy.wallet.0xAbC"], "0xabc")).toBe(true);
    expect(privyConnectorReady(["metaMask"], "0xabc")).toBe(false);
  });
});
