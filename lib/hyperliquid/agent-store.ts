import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Sandia's trading key for one Hyperliquid account. It lives only in this browser. Hyperliquid
 * API wallets can place and cancel orders but cannot withdraw or transfer funds.
 */
export type StoredAgent = { privateKey: `0x${string}`; address: `0x${string}` };

const PREFIX = "sandia.hl.agent.";

function key(user: string): string {
  return `${PREFIX}${user.toLowerCase()}`;
}

export function loadAgent(user: string): StoredAgent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(user));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAgent>;
    if (typeof parsed.privateKey !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.privateKey)) {
      return null;
    }
    const account = privateKeyToAccount(parsed.privateKey as `0x${string}`);
    return { privateKey: parsed.privateKey as `0x${string}`, address: account.address };
  } catch {
    return null;
  }
}

export function createAgent(user: string): StoredAgent {
  const privateKey = generatePrivateKey();
  const agent = { privateKey, address: privateKeyToAccount(privateKey).address };
  window.localStorage.setItem(key(user), JSON.stringify({ privateKey }));
  return agent;
}

export function clearAgent(user: string): void {
  window.localStorage.removeItem(key(user));
}
