export const STEAKHOUSE_USDG_VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd" as const;

export function vaultDepositGate(input: {
  asset: string;
  usdg: string;
  maxDeposit: bigint;
}): { depositEnabled: boolean; reason?: string } {
  if (input.asset.toLowerCase() !== input.usdg.toLowerCase()) {
    return { depositEnabled: false, reason: "Vault asset is not USDG" };
  }
  if (input.maxDeposit <= BigInt(0)) {
    return {
      depositEnabled: false,
      reason: "Deposits are closed because maxDeposit is 0",
    };
  }
  return { depositEnabled: true };
}
