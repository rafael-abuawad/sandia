import { describe, expect, it, vi } from "vitest";
import { resolveIntentWithJev } from "./jev-client";

function decisionResponse(
  overrides: {
    choice?: string;
    probabilities?: Record<string, number>;
    multiple?: number;
  } = {},
) {
  const probabilities = overrides.probabilities ?? {
    send: 0.96,
    batch_send: 0.01,
    request: 0.01,
    trade_long: 0.01,
    trade_short: 0.01,
    unsupported: 0,
  };
  return {
    answers: {
      action: { type: "choice", choice: overrides.choice ?? "send", probabilities },
      multiple_operations: { type: "noul", noul: overrides.multiple ?? 0.01 },
    },
  };
}

describe("Jev request client", () => {
  it("sends the private API request and returns a validated route", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(_input).toBe("https://openrouter.ai/api/alpha/decisions");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "~typesafe/jev-latest",
        state: { user_intent: "Send 100 USDC to Marco" },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(decisionResponse()));
    });
    await expect(
      resolveIntentWithJev("Send 100 USDC to Marco", "test-key", fetcher),
    ).resolves.toMatchObject({
      status: "resolved",
      action: "send",
      confidence: 0.96,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a user choice for an uncertain model decision", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            decisionResponse({
              probabilities: {
                send: 0.61,
                batch_send: 0.02,
                request: 0.29,
                trade_long: 0.04,
                trade_short: 0.02,
                unsupported: 0.02,
              },
            }),
          ),
        ),
    );
    await expect(resolveIntentWithJev("Pay Marco", "test-key", fetcher)).resolves.toMatchObject({
      status: "choose",
    });
  });

  it("rejects malformed decisions and invalid probabilities", async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({ answers: {} })));
    await expect(resolveIntentWithJev("send", "test-key", malformed)).rejects.toThrow(
      "invalid response",
    );
    const invalidProbability = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            decisionResponse({
              probabilities: { ...decisionResponse().answers.action.probabilities, send: 2 },
            }),
          ),
        ),
    );
    await expect(resolveIntentWithJev("send", "test-key", invalidProbability)).rejects.toThrow(
      "invalid action probability",
    );
  });

  it("turns timeouts and provider failures into retryable errors", async () => {
    const timedOut = vi.fn(async () => {
      throw new DOMException("Timed out", "TimeoutError");
    });
    await expect(resolveIntentWithJev("send", "test-key", timedOut)).rejects.toThrow("timed out");
    const unavailable = vi.fn(async () => new Response("provider failure", { status: 502 }));
    await expect(resolveIntentWithJev("send", "test-key", unavailable)).rejects.toThrow("502");
  });
});
