import type { IntentAction, IntentProbabilities, IntentRouting } from "./agent-intent";

export const JEV_ACTIONS = [
  "send",
  "batch_send",
  "request",
  "earn_deposit",
  "earn_withdraw",
  "stock_buy",
  "stock_sell",
  "unsupported",
] as const;

export type JevAction = (typeof JEV_ACTIONS)[number];

export function interpretJevDecision(
  selected: JevAction,
  probabilities: IntentProbabilities,
  multipleOperationProbability: number,
): IntentRouting {
  if (multipleOperationProbability >= 0.85) {
    return {
      status: "unsupported",
      reason: "Choose one operation at a time. A batch send can include several recipients.",
    };
  }

  const confidence = probabilities[selected];
  const runnerUp = Math.max(
    0,
    ...JEV_ACTIONS.filter((action) => action !== selected).map(
      (action) => probabilities[action] ?? 0,
    ),
  );
  if (confidence >= 0.85 && confidence - runnerUp >= 0.2) {
    if (selected === "unsupported") {
      return {
        status: "unsupported",
        reason:
          "I couldn’t match that to one supported operation. Try asking to send, request, deposit, withdraw, buy, or sell.",
      };
    }
    return { status: "resolved", action: selected as IntentAction, confidence, probabilities };
  }
  return { status: "choose", probabilities };
}
