import { describe, expect, it } from "vitest";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { buildUsdgTransferCalls } from "./calls";
import { sponsoredSendRequest } from "./sponsored";

describe("sponsoredSendRequest", () => {
  it("pins a USDG transfer to Robinhood Chain and the signed-in embedded wallet", () => {
    const [call] = buildUsdgTransferCalls([
      { address: "0x1111111111111111111111111111111111111111", amountUsdMicros: 250_000 },
    ]);
    const wallet = "0x2222222222222222222222222222222222222222";
    const request = sponsoredSendRequest(call!, wallet);

    expect(request.transaction).toEqual({
      to: ROBINHOOD_USDG.address,
      data: call!.data,
      value: 0n,
      chainId: ROBINHOOD_USDG.chainId,
    });
    expect(request.options).toEqual({ address: wallet, sponsor: true });
  });
});
