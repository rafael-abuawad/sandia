export type WalletSetupAction = "wait" | "create" | "activate" | "done";

export function walletSetupAction(input: {
  authenticated: boolean;
  walletsReady: boolean;
  embeddedAddress?: string;
  activeAddress?: string;
  connectorReady: boolean;
  createAttempted: boolean;
}): WalletSetupAction {
  if (!input.authenticated || !input.walletsReady) return "wait";
  if (!input.embeddedAddress) return input.createAttempted ? "wait" : "create";
  if (input.activeAddress?.toLowerCase() === input.embeddedAddress.toLowerCase()) return "done";
  if (!input.connectorReady) return "wait";
  return "activate";
}

/** Privy wagmi connector ids end with the embedded wallet address. */
export function privyConnectorReady(
  connectorIds: readonly string[],
  embeddedAddress: string,
): boolean {
  const address = embeddedAddress.toLowerCase();
  return connectorIds.some((id) => id.toLowerCase().includes(address));
}
