import { describe, expect, it } from "vitest";
import { interpretJevDecision, type JevAction } from "./agent-routing";

function probabilities(
  selected: JevAction,
  confidence: number,
  runnerUp = 0,
): Record<string, number> {
  return {
    send: selected === "send" ? confidence : runnerUp,
    batch_send: selected === "batch_send" ? confidence : runnerUp,
    request: selected === "request" ? confidence : runnerUp,
    earn_deposit: selected === "earn_deposit" ? confidence : runnerUp,
    earn_withdraw: selected === "earn_withdraw" ? confidence : runnerUp,
    stock_buy: selected === "stock_buy" ? confidence : runnerUp,
    stock_sell: selected === "stock_sell" ? confidence : runnerUp,
    unsupported: selected === "unsupported" ? confidence : runnerUp,
  };
}

describe("Jev action routing", () => {
  it("opens a clearly selected operation at the chosen confidence threshold", () => {
    expect(interpretJevDecision("send", probabilities("send", 0.85, 0.1), 0.02)).toMatchObject({
      status: "resolved",
      action: "send",
      confidence: 0.85,
    });
  });

  it("asks the user to choose when confidence or the runner-up margin is too small", () => {
    expect(interpretJevDecision("send", probabilities("send", 0.84, 0.1), 0)).toMatchObject({
      status: "choose",
    });
    expect(interpretJevDecision("send", probabilities("send", 0.9, 0.75), 0)).toMatchObject({
      status: "choose",
    });
  });

  it("blocks combined operations and unsupported prompts", () => {
    expect(interpretJevDecision("send", probabilities("send", 0.99, 0), 0.85)).toMatchObject({
      status: "unsupported",
    });
    expect(
      interpretJevDecision("unsupported", probabilities("unsupported", 0.99, 0), 0),
    ).toMatchObject({ status: "unsupported" });
  });
});
