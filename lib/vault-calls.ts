import { encodeFunctionData, erc20Abi, getAddress, parseAbi, type Address, type Hex } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { STEAKHOUSE_USDG_VAULT } from "@/lib/vault-gate";

export const vaultAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function canSendAssets(address account) view returns (bool)",
  "function canReceiveShares(address account) view returns (bool)",
  "function canSendShares(address account) view returns (bool)",
  "function canReceiveAssets(address account) view returns (bool)",
  "function deposit(uint256 assets, address onBehalf) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address onBehalf) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address onBehalf) returns (uint256 assets)",
  "event Deposit(address indexed sender, address indexed onBehalf, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed onBehalf, uint256 assets, uint256 shares)",
]);

export const VAULT_ADDRESS = getAddress(STEAKHOUSE_USDG_VAULT);
const USDG = getAddress(ROBINHOOD_USDG.address);

export type VaultCall = {
  to: Address;
  data: Hex;
  value: bigint;
};

/** Parse a USD field into USDG base units. USDG uses 6 decimals. */
export function parseUsdgBaseUnits(input: string): bigint {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Enter a valid USDG amount with up to 6 decimal places");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  const amount = BigInt(whole) * 1_000_000n + BigInt(fracPadded);
  if (amount <= 0n) throw new Error("Amount must be greater than zero");
  return amount;
}

export function buildVaultApprove(amount: bigint): VaultCall {
  if (amount <= 0n) throw new Error("Amount must be greater than zero");
  return {
    to: USDG,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [VAULT_ADDRESS, amount],
    }),
    value: 0n,
  };
}

export function buildVaultDeposit(amount: bigint, account: Address): VaultCall {
  if (amount <= 0n) throw new Error("Amount must be greater than zero");
  return {
    to: VAULT_ADDRESS,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: "deposit",
      args: [amount, account],
    }),
    value: 0n,
  };
}

export function buildVaultWithdraw(assets: bigint, account: Address): VaultCall {
  if (assets <= 0n) throw new Error("Amount must be greater than zero");
  return {
    to: VAULT_ADDRESS,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: "withdraw",
      args: [assets, account, account],
    }),
    value: 0n,
  };
}

export function buildVaultRedeem(shares: bigint, account: Address): VaultCall {
  if (shares <= 0n) throw new Error("This account has nothing in the vault.");
  return {
    to: VAULT_ADDRESS,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: "redeem",
      args: [shares, account, account],
    }),
    value: 0n,
  };
}

export type VaultExit =
  | { kind: "withdraw"; assets: bigint }
  | { kind: "redeem"; shares: bigint; assets: bigint };

/** A full position uses redeem so rounding cannot leave the withdraw short one unit. */
export function chooseVaultExit(input: {
  assets: bigint;
  positionAssets: bigint;
  shares: bigint;
}): VaultExit {
  if (input.shares <= 0n || input.positionAssets <= 0n) {
    throw new Error("This account has nothing in the vault.");
  }
  if (input.assets <= 0n) throw new Error("Amount must be greater than zero");
  if (input.assets > input.positionAssets) {
    throw new Error("This account doesn't have that much in the vault.");
  }
  if (input.assets === input.positionAssets) {
    return { kind: "redeem", shares: input.shares, assets: input.positionAssets };
  }
  return { kind: "withdraw", assets: input.assets };
}
