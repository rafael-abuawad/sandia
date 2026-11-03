export const MAX_AGENT_PROMPT_LENGTH = 200;

export const INTENT_ACTIONS = [
  "send",
  "batch_send",
  "request",
  "trade_long",
  "trade_short",
] as const;

export type IntentAction = (typeof INTENT_ACTIONS)[number];
export type IntentProbabilities = Record<string, number>;
export type IntentRouting =
  | {
      status: "resolved";
      action: IntentAction;
      confidence: number;
      probabilities: IntentProbabilities;
    }
  | { status: "choose"; probabilities: IntentProbabilities }
  | { status: "unsupported"; reason: string };

export type AgentContact = { name: string; address: string };
/** A tradable Hyperliquid market as the agent sees it. */
export type AgentMarket = {
  coin: string;
  symbol: string;
  name: string;
  keywords: string[];
};
export type BatchRecipientDraft = { address: string; amount: string };

export function resolveExplicitAddress(prompt: string): string {
  return prompt.match(/\b0x[a-fA-F0-9]{40}\b/)?.[0] ?? "";
}

const AMOUNT_TOKEN = String.raw`(?:\$\s*(\d+(?:\.\d{1,6})?)|\b(\d+(?:\.\d{1,6})?)\s*(?:USDC|USD|dollars?|bucks)\b)`;
const AMOUNT_PATTERN = new RegExp(AMOUNT_TOKEN, "gi");

export function extractExplicitAmount(prompt: string): string | null {
  if (/%|\b(?:half|quarter|twice|double|split|remaining|all)\b/i.test(prompt)) return null;
  const matches = [...prompt.matchAll(AMOUNT_PATTERN)];
  if (matches.length !== 1) return null;
  return matches[0][1] ?? matches[0][2] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contactMentions(prompt: string, contacts: AgentContact[]) {
  return contacts
    .flatMap((contact) => {
      const name = contact.name.trim();
      if (!name) return [];
      const match = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(name)}(?=$|[^a-z0-9])`, "iu").exec(
        prompt,
      );
      const index = match ? match.index + match[0].length - name.length : -1;
      return index >= 0 ? [{ contact, index }] : [];
    })
    .sort((a, b) => a.index - b.index);
}

export function resolveNamedContact(prompt: string, contacts: AgentContact[]) {
  const mentions = contactMentions(prompt, contacts);
  if (mentions.length !== 1) {
    return {
      address: "",
      ambiguous:
        mentions.length > 1 &&
        mentions[0]?.contact.name.toLowerCase() === mentions[1]?.contact.name.toLowerCase(),
    };
  }
  return { address: mentions[0].contact.address, ambiguous: false };
}

export function resolveBatchRecipients(
  prompt: string,
  contacts: AgentContact[],
): BatchRecipientDraft[] {
  const mentions = contactMentions(prompt, contacts).map(({ contact, index }) => ({
    address: contact.address,
    index,
  }));
  const addresses = [...prompt.matchAll(/\b0x[a-fA-F0-9]{40}\b/g)].map((match) => ({
    address: match[0],
    index: match.index ?? 0,
  }));
  const recipients = [...mentions, ...addresses].sort((a, b) => a.index - b.index);
  if (recipients.length < 2) return [];
  if (
    recipients.some(
      (recipient, index) => index > 0 && recipient.index === recipients[index - 1].index,
    )
  )
    return [];
  const amounts = [...prompt.matchAll(AMOUNT_PATTERN)].map((match) => match[1] ?? match[2] ?? "");
  const isEach = /\beach\b/i.test(prompt);
  if (isEach && amounts.length === 1)
    return recipients.map(({ address }) => ({ address, amount: amounts[0] }));
  if (amounts.length !== recipients.length) return [];
  return recipients.map(({ address }, index) => ({ address, amount: amounts[index] }));
}

const MARKET_ALIASES: Record<string, string> = {
  NVDIA: "NVIDIA",
  BITCOIN: "BTC",
  ETHER: "ETH",
  ETHEREUM: "ETH",
  SOLANA: "SOL",
};

/**
 * One market named in the prompt, or null when none or several match. Tickers and names match
 * as whole words, so "F" never matches "for". Topic keywords are ignored because many markets
 * share them. Crypto wins a tie with a same-named HIP-3 market.
 */
export function resolveMarket(prompt: string, markets: AgentMarket[]): AgentMarket | null {
  let normalized = prompt;
  for (const [alias, target] of Object.entries(MARKET_ALIASES)) {
    normalized = normalized.replace(new RegExp(`\\b${alias}\\b`, "giu"), target);
  }
  const matches = markets.filter((market) =>
    [market.symbol, market.name].some((label) => {
      const value = label.trim();
      if (!value || /^(?:usd|usdc|dollars?)$/i.test(value)) return false;
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(value)}(?=$|[^a-z0-9])`, "iu").test(
        normalized,
      );
    }),
  );
  const unique = new Map(matches.map((market) => [market.symbol.toUpperCase(), market]));
  if (unique.size !== 1) return null;
  const symbol = [...unique.keys()][0];
  return (
    matches.find(
      (market) => market.symbol.toUpperCase() === symbol && !market.coin.includes(":"),
    ) ?? matches[0]
  );
}

/** Leverage like "5x" or "10x leverage". */
export function extractLeverage(prompt: string): number | null {
  const match = /\b(\d{1,2})\s*x\b/i.exec(prompt);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 50 ? value : null;
}
