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
});
