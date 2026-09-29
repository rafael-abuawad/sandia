import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { ROBINHOOD_USDG } from "@/lib/destination";
import { buildSandiaSendCall, buildUsdgTransferCalls, type TransferCall } from "@/lib/send/calls";
import type { ReviewPayload } from "@/components/send-form/state";

type BalanceRead = {
  address: Address;
  abi: typeof erc20Abi;
  functionName: "balanceOf";
  args: [Address];
};

type AllowanceRead = {
  address: Address;
  abi: typeof erc20Abi;
  functionName: "allowance";
  args: [Address, Address];
};

export type SendExecutionClient = {
  readContract: (request: BalanceRead | AllowanceRead) => Promise<bigint>;
  call: (request: { account: Address; to: Address; data: Hex; value: bigint }) => Promise<unknown>;
  waitForTransactionReceipt: (request: {
    hash: Hex;
    timeout: number;
  }) => Promise<{ status: "success" | "reverted" }>;
};

export type SubmittedSendTransaction = {
  hash: Hex;
  stage: "approval" | "transfer" | "activity";
  label: string;
};

type SendCall = Pick<TransferCall, "to" | "data" | "value">;

export async function executeSend({
  review,
  account,
  chainId,
  client,
  pending,
  sendSponsored,
  onSubmitted,
  onCleared,
}: {
  review: ReviewPayload;
  account: Address;
  chainId: number | undefined;
  client: SendExecutionClient;
  pending: SubmittedSendTransaction | null;
  sendSponsored: (call: SendCall, stage: "approval" | "transfer", label: string) => Promise<Hex>;
  onSubmitted: (transaction: SubmittedSendTransaction) => void;
  onCleared: () => void;
}): Promise<{ hash: Hex; calls: Array<{ recipient: Address; amount: bigint }> }> {
  const calls = review.recipients.map((recipient) => ({
    recipient: recipient.address as Address,
    amount: BigInt(recipient.amountUsdMicros),
  }));

  if (pending?.stage === "transfer") {
    await waitForSuccess(client, pending, onCleared);
    return { hash: pending.hash, calls };
  }

  if (pending?.stage === "activity") {
    throw new Error(
      "This transfer is confirmed. Retry its activity update before starting another send.",
    );
  }

  if (pending?.stage === "approval") {
    await waitForSuccess(client, pending, onCleared);
  }

  if (chainId !== ROBINHOOD_USDG.chainId) {
    throw new Error("Switch to Robinhood Chain before confirming this send.");
  }

  const currentBalance = await client.readContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
  if (currentBalance < BigInt(review.totalUsdMicros)) {
    throw new Error("This wallet doesn't have enough USDG on Robinhood Chain.");
  }

  const recipientInputs = review.recipients.map((recipient) => ({
    address: recipient.address,
    amountUsdMicros: recipient.amountUsdMicros,
  }));

  if (recipientInputs.length === 1) {
    const [call] = buildUsdgTransferCalls(recipientInputs);
    if (!call) throw new Error("Add a recipient");
    await simulate(client, account, call);
    const hash = await submitAndWait(
      call,
      "transfer",
      "Confirm USDG transfer in your wallet",
      sendSponsored,
      onSubmitted,
      onCleared,
      client,
    );
    return { hash, calls };
  }

  const batch = buildSandiaSendCall(recipientInputs);
  const allowance = await client.readContract({
    address: ROBINHOOD_USDG.address as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, batch.to],
  });

  if (allowance < batch.total) {
    const approval: SendCall = {
      to: ROBINHOOD_USDG.address as Address,
      data: encodeApproval(batch.to, batch.total),
      value: 0n,
    };
    await simulate(client, account, approval);
    await submitAndWait(
      approval,
      "approval",
      "Approve exact USDG batch amount",
      sendSponsored,
      onSubmitted,
      onCleared,
      client,
    );
    const confirmedAllowance = await client.readContract({
      address: ROBINHOOD_USDG.address as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, batch.to],
    });
    if (confirmedAllowance < batch.total) {
      throw new Error("USDG approval confirmed, but the batch is not ready yet. Try again.");
    }
  }

  await simulate(client, account, batch);
  const hash = await submitAndWait(
    batch,
    "transfer",
    "Confirm USDG batch send in your wallet",
    sendSponsored,
    onSubmitted,
    onCleared,
    client,
  );
  return { hash, calls };
}

async function simulate(client: SendExecutionClient, account: Address, call: SendCall) {
  await client.call({ account, ...call });
}

async function submitAndWait(
  call: SendCall,
  stage: "approval" | "transfer",
  label: string,
  sendSponsored: (call: SendCall, stage: "approval" | "transfer", label: string) => Promise<Hex>,
  onSubmitted: (transaction: SubmittedSendTransaction) => void,
  onCleared: () => void,
  client: SendExecutionClient,
): Promise<Hex> {
  const hash = await sendSponsored(call, stage, label);
  const transaction = { hash, stage, label } as const;
  onSubmitted(transaction);
  await waitForSuccess(client, transaction, onCleared);
  return hash;
}

async function waitForSuccess(
  client: SendExecutionClient,
  transaction: SubmittedSendTransaction,
  onCleared: () => void,
) {
  const receipt = await client.waitForTransactionReceipt({
    hash: transaction.hash,
    timeout: 60_000,
  });
  if (receipt.status !== "success") {
    onCleared();
    throw new Error(
      transaction.stage === "approval"
        ? "USDG approval reverted. Review the batch and try again."
        : "The transfer reverted on Robinhood Chain. Review the send and try again.",
    );
  }
  if (transaction.stage === "approval") onCleared();
}

function encodeApproval(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
}
