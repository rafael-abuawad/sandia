export type WalletSetupAction = "wait" | "create" | "done";

export function walletSetupAction(input: {
  authenticated: boolean;
  ready: boolean;
  stellarAddress?: string;
  createAttempted: boolean;
}): WalletSetupAction {
  if (!input.authenticated || !input.ready) return "wait";
  if (input.stellarAddress) return "done";
  return input.createAttempted ? "wait" : "create";
}

type LinkedAccount = {
  type?: string;
  chainType?: string;
  walletClientType?: string;
  address?: string;
};

/** The user's Privy-managed Stellar wallet, from the accounts linked to their sign-in. */
export function stellarWalletAddress(accounts: readonly unknown[] | undefined): string | undefined {
  const wallet = (accounts as readonly LinkedAccount[] | undefined)?.find(
    (account) =>
      account.type === "wallet" &&
      account.chainType === "stellar" &&
      account.walletClientType === "privy",
  );
  return wallet?.address;
}
