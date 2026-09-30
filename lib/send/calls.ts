import { encodeFunctionData, erc20Abi, getAddress, isAddress, type Address, type Hex } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";

/** Matches `MAX_SEND_LENGTH` in `sandia-core/src/Send.vy`. */
export const MAX_SEND_RECIPIENTS = 128;

export const sandiaSendAbi = [
  {
    type: "function",
    name: "sandia_send",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "recipients",
        type: "tuple[]",
        components: [
          { name: "account", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      { name: "currency", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function sandiaSendAddress(): Address {
  const raw = process.env.NEXT_PUBLIC_SANDIA_SEND_ADDRESS;
  if (!raw || !isAddress(raw)) {
    throw new Error("Sandia Send is not configured");
  }
  return getAddress(raw);
}

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

export type SandiaRecipient = {
  account: Address;
  amount: bigint;
};

export type SandiaSendCall = {
  to: Address;
  data: Hex;
  value: bigint;
  recipients: SandiaRecipient[];
  total: bigint;
};

type SendRecipientInput = { address: string; amountUsdMicros: number };

function parseSendRecipients(recipients: SendRecipientInput[]): SandiaRecipient[] {
  if (recipients.length === 0) throw new Error("Add a recipient");
  if (recipients.length > MAX_SEND_RECIPIENTS) {
    throw new Error(`A batch can include at most ${MAX_SEND_RECIPIENTS} recipients`);
  }
  const seen = new Set<string>();
  return recipients.map((row, index) => {
    if (!isAddress(row.address)) {
      throw new Error(`Recipient ${index + 1} is not a valid address`);
    }
    const account = getAddress(row.address);
    const key = account.toLowerCase();
    if (seen.has(key)) throw new Error("Each recipient can appear once");
    seen.add(key);
    return { account, amount: usdMicrosToUsdgBaseUnits(row.amountUsdMicros) };
  });
}

/** One ERC-20 transfer per recipient. Each transfer is its own transaction. */
export function buildUsdgTransferCalls(recipients: SendRecipientInput[]): TransferCall[] {
  return parseSendRecipients(recipients).map((row) => encodeUsdgTransfer(row.account, row.amount));
}

/** One `sandia_send` for two or more recipients. `total` is the USDG approval amount. */
export function buildSandiaSendCall(recipients: SendRecipientInput[]): SandiaSendCall {
  if (recipients.length < 2) {
    throw new Error("A batch needs at least two recipients");
  }
  const parsed = parseSendRecipients(recipients);
  const total = parsed.reduce((sum, row) => sum + row.amount, 0n);
  return {
    to: sandiaSendAddress(),
    data: encodeFunctionData({
      abi: sandiaSendAbi,
      functionName: "sandia_send",
      args: [parsed, ROBINHOOD_USDG.address],
    }),
    value: BigInt(0),
    recipients: parsed,
    total,
  };
}
