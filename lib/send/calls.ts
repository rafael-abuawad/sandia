import { encodeFunctionData, erc20Abi, isAddress, type Address, type Hex } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";

export const MAX_SEND_RECIPIENTS = 20;

export type TransferCall = {
  to: Address;
  data: Hex;
  value: bigint;
  recipient: Address;
  amount: bigint;
};

export function usdMicrosToUsdgBaseUnits(amountUsdMicros: number): bigint {
  if (!Number.isInteger(amountUsdMicros) || amountUsdMicros <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return BigInt(amountUsdMicros);
}

function encodeUsdgTransfer(recipient: Address, amount: bigint): TransferCall {
  return {
    to: ROBINHOOD_USDG.address as Address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amount],
    }),
    value: BigInt(0),
    recipient,
    amount,
  };
}

/** One USDG transfer for a payment request. Amount is already in token base units. */
export function buildUsdgPaymentTransfer(
  recipientAddress: string,
  amountBaseUnits: string,
): TransferCall {
  if (!isAddress(recipientAddress)) {
    throw new Error("Recipient is not a valid address");
  }
  if (!/^\d+$/.test(amountBaseUnits)) {
    throw new Error("Amount must be greater than zero");
  }
  const amount = BigInt(amountBaseUnits);
  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  return encodeUsdgTransfer(recipientAddress.toLowerCase() as Address, amount);
}

/** One ERC-20 transfer per recipient. Each transfer is its own transaction. */
export function buildUsdgTransferCalls(
  recipients: Array<{ address: string; amountUsdMicros: number }>,
): TransferCall[] {
  if (recipients.length === 0) throw new Error("Add a recipient");
  if (recipients.length > MAX_SEND_RECIPIENTS) {
    throw new Error(`A batch can include at most ${MAX_SEND_RECIPIENTS} recipients`);
  }
  const seen = new Set<string>();
  return recipients.map((row, index) => {
    if (!isAddress(row.address)) {
      throw new Error(`Recipient ${index + 1} is not a valid address`);
    }
    const recipient = row.address.toLowerCase() as Address;
    if (seen.has(recipient)) throw new Error("Each recipient can appear once");
    seen.add(recipient);
    return encodeUsdgTransfer(recipient, usdMicrosToUsdgBaseUnits(row.amountUsdMicros));
  });
}
