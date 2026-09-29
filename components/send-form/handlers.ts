import type { Address, Hex } from "viem";
import { sponsoredSendRequest } from "@/lib/send/sponsored";
import { validateReviewPayload } from "@/components/send-form/helpers";
import type { RecipientRow, SendFormAction, SendMode } from "@/components/send-form/state";

type Dispatch = React.Dispatch<SendFormAction>;
type EmbeddedWallet = { switchChain: (chainId: number) => Promise<unknown> } | null | undefined;
type PrivySendTransaction = ReturnType<
  typeof import("@privy-io/react-auth").useSendTransaction
>["sendTransaction"];

export function submitSendReview({
  event,
  isSignedIn,
  mode,
  singleAddress,
  singleAmount,
  rows,
  dispatch,
}: {
  event: React.FormEvent;
  isSignedIn: boolean;
  mode: SendMode;
  singleAddress: string;
  singleAmount: string;
  rows: RecipientRow[];
  dispatch: Dispatch;
}) {
  event.preventDefault();
  if (!isSignedIn) {
    dispatch({ type: "setError", error: "Sign in to continue" });
    return;
  }

  const result = validateReviewPayload(mode, singleAddress, singleAmount, rows);
  if (!result.review) {
    dispatch({
      type: "validationFailed",
      error: result.error,
      fieldErrors: result.fieldErrors,
    });
    return;
  }
  dispatch({ type: "reviewReady", review: result.review });
}

export function createSponsoredSender({
  address,
  sendTransaction,
  dispatch,
}: {
  address: Address | undefined;
  sendTransaction: PrivySendTransaction;
  dispatch: Dispatch;
}) {
  return async function sendSponsored(
    call: { to: Address; data: Hex; value: bigint },
    stage: "approval" | "transfer",
    label: string,
  ): Promise<Hex> {
    if (!address) throw new Error("Sign in to send USDG.");
    dispatch({ type: "transactionAwaiting", stage, label });
    const request = sponsoredSendRequest(call, address);
    const { hash } = await sendTransaction(request.transaction, request.options);
    if (!hash.startsWith("0x") || hash.length !== 66) {
      throw new Error("The wallet did not return a valid transaction hash.");
    }
    return hash;
  };
}

export function maybeSwitchEmbeddedChain({
  isSignedIn,
  address,
  chainId,
  embedded,
  attemptedChainSwitch,
  targetChainId,
}: {
  isSignedIn: boolean;
  address: Address | undefined;
  chainId: number | undefined;
  embedded: EmbeddedWallet;
  attemptedChainSwitch: { current: string | null };
  targetChainId: number;
}) {
  if (!isSignedIn || !address || !embedded || chainId === undefined) return;
  if (chainId === targetChainId) {
    attemptedChainSwitch.current = null;
    return;
  }

  const key = `${address.toLowerCase()}:${chainId}`;
  if (attemptedChainSwitch.current === key) return;
  attemptedChainSwitch.current = key;
  void embedded.switchChain(targetChainId).catch((error: unknown) => {
    console.error("embedded_wallet_chain_switch_failed", {
      message: error instanceof Error ? error.message : "Could not switch embedded wallet chain",
    });
  });
}
