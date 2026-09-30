export const MAX_AGENT_PROMPT_LENGTH = 200;

export const INTENT_ACTIONS = [
  "send",
  "batch_send",
  "request",
  "earn_deposit",
  "earn_withdraw",
  "stock_buy",
  "stock_sell",
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
export type AgentStock = {
  symbol: string;
  name: string;
  shortName: string;
  contractAddress: string;
  tokenDecimals: number;
};
export type BatchRecipientDraft = { address: string; amount: string };

export function resolveExplicitAddress(prompt: string): string {
  return prompt.match(/\b0x[a-fA-F0-9]{40}\b/)?.[0] ?? "";
}

const AMOUNT_TOKEN = String.raw`(?:\$\s*(\d+(?:\.\d{1,6})?)|\b(\d+(?:\.\d{1,6})?)\s*(?:USDG|USD|dollars?|shares?)\b)`;
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

export function resolveStock(prompt: string, assets: AgentStock[]): AgentStock | null {
  const upper = prompt.toLocaleUpperCase();
  const candidates = assets.flatMap((asset) => {
    const labels = [asset.symbol, asset.name, asset.shortName].filter(Boolean);
    const matched = labels.some((label) => {
      const normalized = label.toLocaleUpperCase();
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalized)}(?:$|[^a-z0-9])`, "u").test(
        upper,
      );
    });
    return matched ? [asset] : [];
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return null;

  const corrected = upper.replace(/\bNVDIA\b/g, "NVIDIA");
  const nvidia = assets.filter((asset) =>
    [asset.symbol, asset.name, asset.shortName].some((label) =>
      new RegExp(
        `(?:^|[^a-z0-9])${escapeRegExp(label.toLocaleUpperCase())}(?:$|[^a-z0-9])`,
        "u",
      ).test(corrected),
    ),
  );
  return nvidia.length === 1 ? nvidia[0] : null;
}

export function extractStockUnit(prompt: string): "usd" | "shares" | null {
  const usd = /\$|\b(?:USD|USDG|dollars?)\b/i.test(prompt);
  const shares = /\bshares?\b/i.test(prompt);
  if (usd === shares) return null;
  return usd ? "usd" : "shares";
}
