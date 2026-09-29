export const STEAKHOUSE_USDG_VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd" as const;

export type VaultGate = {
  enabled: boolean;
  reason?: string;
};

/** Deposit is allowed when this account can send USDG and receive vault shares. */
export function vaultDepositGate(input: {
  canSendAssets: boolean;
  canReceiveShares: boolean;
}): VaultGate {
  if (!input.canSendAssets || !input.canReceiveShares) {
    return { enabled: false, reason: "This account can't deposit into the vault." };
  }
  return { enabled: true };
}

/** Withdraw and redeem are allowed when this account can burn shares and receive USDG. */
export function vaultExitGate(input: {
  canSendShares: boolean;
  canReceiveAssets: boolean;
}): VaultGate {
  if (!input.canSendShares || !input.canReceiveAssets) {
    return { enabled: false, reason: "This account can't withdraw from the vault." };
  }
  return { enabled: true };
}
