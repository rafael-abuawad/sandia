import { describe, expect, it } from "vitest";
import { stellarWalletAddress, walletSetupAction } from "./wallet-setup";

const ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("walletSetupAction", () => {
  it("waits until Privy is ready", () => {
    expect(walletSetupAction({ authenticated: true, ready: false, createAttempted: false })).toBe(
      "wait",
    );
    expect(walletSetupAction({ authenticated: false, ready: true, createAttempted: false })).toBe(
      "wait",
    );
  });

  it("creates a wallet once when none exists", () => {
    expect(walletSetupAction({ authenticated: true, ready: true, createAttempted: false })).toBe(
      "create",
    );
    expect(walletSetupAction({ authenticated: true, ready: true, createAttempted: true })).toBe(
      "wait",
    );
  });

  it("is done when a Stellar wallet exists", () => {
    expect(
      walletSetupAction({
        authenticated: true,
        ready: true,
        createAttempted: false,
        stellarAddress: ADDRESS,
      }),
    ).toBe("done");
  });
});

describe("stellarWalletAddress", () => {
  it("finds only the embedded Stellar wallet and keeps its case", () => {
    expect(
      stellarWalletAddress([
        { type: "email", address: "a@b.co" },
        { type: "wallet", chainType: "ethereum", walletClientType: "privy", address: "0xabc" },
        { type: "wallet", chainType: "stellar", walletClientType: "freighter", address: "GOTHER" },
        { type: "wallet", chainType: "stellar", walletClientType: "privy", address: ADDRESS },
      ]),
    ).toBe(ADDRESS);
  });

  it("returns undefined without one", () => {
    expect(stellarWalletAddress(undefined)).toBeUndefined();
    expect(stellarWalletAddress([])).toBeUndefined();
  });
});
