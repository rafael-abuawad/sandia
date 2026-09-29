import { interpretJevDecision, JEV_ACTIONS, type JevAction } from "./agent-routing";
import type { IntentProbabilities, IntentRouting } from "./agent-intent";

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProbabilities(value: unknown): IntentProbabilities {
  if (!isRecord(value))
    throw new Error("AI Agent received an invalid action distribution. Try again.");
  const result: IntentProbabilities = {};
  for (const action of JEV_ACTIONS) {
    const probability = value[action];
    if (
      typeof probability !== "number" ||
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new Error("AI Agent received an invalid action probability. Try again.");
    }
    result[action] = probability;
  }
  return result;
}

export async function resolveIntentWithJev(
  prompt: string,
  apiKey: string,
  fetcher: FetchLike = fetch,
): Promise<IntentRouting> {
  let response: Response;
  try {
    response = await fetcher("https://openrouter.ai/api/alpha/decisions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "~typesafe/jev-latest",
        state: { user_intent: prompt },
        questions: {
          action: {
            type: "choice",
            instructions:
              "Choose the single financial operation the user explicitly requested. Select unsupported for questions, advice, unrelated tasks, missing operation intent, or compound requests that combine different financial operations.",
            criteria: {
              send: "Send USDG to one recipient. A named or addressed recipient, optionally with an amount.",
              batch_send:
                "Send USDG to multiple recipients in one batch, with explicit per-recipient or each amounts.",
              request: "Create a payment request for USDG.",
              earn_deposit: "Deposit USDG into the Earn vault.",
              earn_withdraw: "Withdraw or redeem funds from the Earn vault.",
              stock_buy: "Buy a stock token using USDG.",
              stock_sell: "Sell a stock token for USDG.",
              unsupported:
                "No single supported operation was explicitly requested, or the request combines multiple different operations.",
            },
          },
          multiple_operations: {
            type: "noul",
            instructions:
              "Does this request ask to perform two or more distinct financial operations? A batch send to multiple recipients is one operation. A send and a deposit together are multiple operations.",
            criteria: {
              true: "The user explicitly asks for multiple distinct financial operations.",
              false: "The user asks for one operation or an unsupported question/task.",
            },
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
      throw new Error("AI Agent timed out. Try again.");
    }
    throw new Error("AI Agent could not reach the intent service. Try again.");
  }

  if (!response.ok)
    throw new Error(
      "AI Agent could not classify this intent (" + response.status + "). Try again.",
    );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("AI Agent received an invalid response. Try again.");
  }
  if (!isRecord(payload) || !isRecord(payload.answers)) {
    throw new Error("AI Agent received an invalid response. Try again.");
  }
  const actionAnswer = payload.answers.action;
  const multiAnswer = payload.answers.multiple_operations;
  if (
    !isRecord(actionAnswer) ||
    actionAnswer.type !== "choice" ||
    typeof actionAnswer.choice !== "string" ||
    !isRecord(multiAnswer) ||
    multiAnswer.type !== "noul" ||
    typeof multiAnswer.noul !== "number" ||
    !Number.isFinite(multiAnswer.noul) ||
    multiAnswer.noul < 0 ||
    multiAnswer.noul > 1 ||
    !JEV_ACTIONS.includes(actionAnswer.choice as JevAction)
  ) {
    throw new Error("AI Agent received an invalid response. Try again.");
  }
  const probabilities = readProbabilities(actionAnswer.probabilities);
  return interpretJevDecision(actionAnswer.choice as JevAction, probabilities, multiAnswer.noul);
}
