import { describe, expect, it } from "vitest";
import { isPayerTokenAllowed } from "./chains";
import { ROBINHOOD_USDG } from "./destination";

const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ZERO = "0x0000000000000000000000000000000000000000";

describe("isPayerTokenAllowed", () => {
  it("limits Robinhood to WETH and USDG", () => {
    expect(isPayerTokenAllowed("WETH", WETH, 4663)).toBe(true);
    expect(isPayerTokenAllowed("USDG", ROBINHOOD_USDG.address, 4663)).toBe(true);
    expect(isPayerTokenAllowed("ETH", ZERO, 4663)).toBe(false);
    expect(isPayerTokenAllowed("USDC", USDC, 4663)).toBe(false);
    expect(isPayerTokenAllowed("USDG", ROBINHOOD_USDG.address, 8453)).toBe(false);
    expect(isPayerTokenAllowed("USDC", USDC, 8453)).toBe(true);
  });

  it("offers native ETH instead of WETH on ETH-native chains", () => {
    const BASE_WETH = "0x4200000000000000000000000000000000000006";
    const MAINNET_WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    for (const chainId of [1, 10, 8453, 42161]) {
      expect(isPayerTokenAllowed("ETH", ZERO, chainId)).toBe(true);
    }
    expect(isPayerTokenAllowed("WETH", BASE_WETH, 8453)).toBe(false);
    expect(isPayerTokenAllowed("WETH", MAINNET_WETH, 1)).toBe(false);
  });

  it("keeps bridged WETH and skips native placeholders on non-ETH chains", () => {
    expect(isPayerTokenAllowed("WETH", "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", 56)).toBe(
      true,
    );
    expect(isPayerTokenAllowed("WETH", "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 137)).toBe(
      true,
    );
    expect(isPayerTokenAllowed("BNB", ZERO, 56)).toBe(false);
    expect(isPayerTokenAllowed("POL", ZERO, 137)).toBe(false);
  });

  it("limits gas tokens to their home chain", () => {
    expect(isPayerTokenAllowed("POL", "0x455e53cbb86018ac2b8092fdcd39d8444affc3f6", 1)).toBe(false);
    expect(isPayerTokenAllowed("MATIC", "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", 1)).toBe(
      false,
    );
    expect(isPayerTokenAllowed("MATIC", "0x561877b6b3DD7651313794e5F2894B2F18bE0766", 42161)).toBe(
      false,
    );
    expect(isPayerTokenAllowed("POL", "0x044d8e7F3A17751D521efEa8CCf9282268fE08CC", 42161)).toBe(
      false,
    );
    expect(isPayerTokenAllowed("MATIC", "0xCC42724C6683B7E57334c4E856f4c9965ED682bD", 56)).toBe(
      false,
    );
    expect(isPayerTokenAllowed("WPOL", "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", 137)).toBe(
      true,
    );
    expect(isPayerTokenAllowed("WBNB", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 56)).toBe(true);
    expect(isPayerTokenAllowed("WAVAX", "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", 43114)).toBe(
      true,
    );
  });
});
