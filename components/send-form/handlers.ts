import { validateReviewPayload } from "@/components/send-form/helpers";
import type { RecipientRow, SendFormAction, SendMode } from "@/components/send-form/state";

type Dispatch = React.Dispatch<SendFormAction>;

export function submitSendReview({
  event,
  isSignedIn,
  mode,
  singleAddress,
  singleAmount,
  singleMemo,
  rows,
  dispatch,
}: {
  event: React.FormEvent;
  isSignedIn: boolean;
  mode: SendMode;
  singleAddress: string;
  singleAmount: string;
  singleMemo: string;
  rows: RecipientRow[];
  dispatch: Dispatch;
}) {
  event.preventDefault();
  if (!isSignedIn) {
    dispatch({ type: "setError", error: "Sign in to continue" });
    return;
  }

  const result = validateReviewPayload(mode, singleAddress, singleAmount, rows, singleMemo);
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
