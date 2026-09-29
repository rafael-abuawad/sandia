export type SendMode = "single" | "massive";
export type SendStep = "compose" | "review" | "success";
export type SendTransactionStage = "approval" | "transfer" | "activity";
export type SendTransactionPhase =
  | "idle"
  | "awaiting-wallet"
  | "confirming"
  | "pending"
  | "recording";

export type SendTransactionProgress = {
  phase: SendTransactionPhase;
  stage: SendTransactionStage | null;
  label: string | null;
  hash: `0x${string}` | null;
};

export type RecipientRow = {
  id: string;
  address: string;
  amount: string;
};

export type ReviewRecipient = {
  address: `0x${string}`;
  amountUsdMicros: number;
};

export type ReviewPayload = {
  mode: SendMode;
  recipients: ReviewRecipient[];
  totalUsdMicros: number;
};

export function newRecipientRow(): RecipientRow {
  return {
    id: crypto.randomUUID(),
    address: "",
    amount: "",
  };
}

export type SendFormState = {
  mode: SendMode;
  step: SendStep;
  singleAddress: string;
  singleAmount: string;
  rows: RecipientRow[];
  review: ReviewPayload | null;
  error: string | null;
  confirming: boolean;
  fieldErrors: Record<string, { address?: string; amount?: string }>;
  progress: SendTransactionProgress;
  activityError: string | null;
  validationAttempt: number;
};

export const initialSendFormState: SendFormState = {
  mode: "single",
  step: "compose",
  singleAddress: "",
  singleAmount: "10",
  rows: [], // filled in initializer
  review: null,
  error: null,
  confirming: false,
  fieldErrors: {},
  progress: { phase: "idle", stage: null, label: null, hash: null },
  activityError: null,
  validationAttempt: 0,
};

export function createInitialSendFormState(initial?: {
  mode?: SendMode;
  address?: string;
  amount?: string;
  recipients?: Array<{ address: string; amount: string }>;
}): SendFormState {
  return {
    ...initialSendFormState,
    mode: initial?.mode ?? (initial?.recipients ? "massive" : "single"),
    singleAddress: initial?.address ?? "",
    singleAmount: initial?.amount ?? initialSendFormState.singleAmount,
    rows: initial?.recipients?.length
      ? initial.recipients.map((recipient) => ({ id: crypto.randomUUID(), ...recipient }))
      : [newRecipientRow(), newRecipientRow()],
  };
}

export type SendFormAction =
  | { type: "reset" }
  | { type: "setMode"; mode: SendMode }
  | { type: "setSingleAddress"; address: string }
  | { type: "setSingleAmount"; amount: string }
  | { type: "setRows"; rows: RecipientRow[] }
  | { type: "addRow" }
  | { type: "removeRow"; id: string }
  | { type: "updateRow"; id: string; patch: Partial<Omit<RecipientRow, "id">> }
  | { type: "reviewReady"; review: ReviewPayload }
  | { type: "backToCompose" }
  | { type: "confirmStarted" }
  | { type: "confirmFinished" }
  | { type: "setError"; error: string | null }
  | { type: "validationFailed"; error: string | null; fieldErrors: SendFormState["fieldErrors"] }
  | { type: "transactionAwaiting"; stage: SendTransactionStage; label: string }
  | {
      type: "transactionSubmitted";
      stage: SendTransactionStage;
      label: string;
      hash: `0x${string}`;
    }
  | { type: "transactionPending" }
  | { type: "transactionRecording"; hash: `0x${string}` }
  | { type: "transactionCleared" }
  | { type: "activitySyncStarted" }
  | { type: "confirmSucceeded"; activityError?: string };

export function sendFormReducer(state: SendFormState, action: SendFormAction): SendFormState {
  switch (action.type) {
    case "reset":
      return createInitialSendFormState();
    case "setMode":
      return { ...state, mode: action.mode, error: null, fieldErrors: {} };
    case "setSingleAddress":
      return {
        ...state,
        singleAddress: action.address,
        error: null,
        fieldErrors: {
          ...state.fieldErrors,
          single: { ...state.fieldErrors.single, address: undefined },
        },
      };
    case "setSingleAmount":
      return {
        ...state,
        singleAmount: action.amount,
        error: null,
        fieldErrors: {
          ...state.fieldErrors,
          single: { ...state.fieldErrors.single, amount: undefined },
        },
      };
    case "setRows":
      return { ...state, rows: action.rows, fieldErrors: {}, error: null };
    case "addRow":
      return { ...state, rows: [...state.rows, newRecipientRow()], fieldErrors: {}, error: null };
    case "removeRow":
      return {
        ...state,
        rows: state.rows.filter((r) => r.id !== action.id),
        fieldErrors: Object.fromEntries(
          Object.entries(state.fieldErrors).filter(([id]) => id !== action.id),
        ),
        error: null,
      };
    case "updateRow":
      return {
        ...state,
        rows: state.rows.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
        fieldErrors: {
          ...state.fieldErrors,
          [action.id]: {
            ...state.fieldErrors[action.id],
            ...(action.patch.address !== undefined ? { address: undefined } : {}),
            ...(action.patch.amount !== undefined ? { amount: undefined } : {}),
          },
        },
        error: null,
      };
    case "reviewReady":
      return {
        ...state,
        review: action.review,
        step: "review",
        error: null,
        fieldErrors: {},
      };
    case "backToCompose":
      return { ...state, step: "compose", error: null, fieldErrors: {} };
    case "confirmStarted":
      return { ...state, confirming: true, error: null };
    case "confirmFinished":
      return { ...state, confirming: false };
    case "setError":
      return { ...state, error: action.error };
    case "validationFailed":
      return {
        ...state,
        error: action.error,
        fieldErrors: action.fieldErrors,
        validationAttempt: state.validationAttempt + 1,
      };
    case "transactionAwaiting":
      return {
        ...state,
        error: null,
        progress: {
          phase: "awaiting-wallet",
          stage: action.stage,
          label: action.label,
          hash: null,
        },
      };
    case "transactionSubmitted":
      return {
        ...state,
        progress: {
          phase: "confirming",
          stage: action.stage,
          label: action.label,
          hash: action.hash,
        },
      };
    case "transactionPending":
      return { ...state, progress: { ...state.progress, phase: "pending" } };
    case "transactionRecording":
    case "activitySyncStarted":
      return {
        ...state,
        activityError: null,
        progress: {
          phase: "recording",
          stage: "activity",
          label: "Updating send activity",
          hash: action.type === "transactionRecording" ? action.hash : state.progress.hash,
        },
      };
    case "transactionCleared":
      return {
        ...state,
        progress: { phase: "idle", stage: null, label: null, hash: null },
      };
    case "confirmSucceeded":
      return {
        ...state,
        step: "success",
        confirming: false,
        activityError: action.activityError ?? null,
        progress: { ...state.progress, phase: "idle" },
      };
    default:
      return state;
  }
}
