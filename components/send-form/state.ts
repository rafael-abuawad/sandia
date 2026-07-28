export type SendMode = "single" | "massive";
export type SendStep = "compose" | "review" | "success";

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
};

export function createInitialSendFormState(): SendFormState {
  return {
    ...initialSendFormState,
    rows: [newRecipientRow(), newRecipientRow()],
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
  | { type: "confirmSucceeded" }
  | { type: "setError"; error: string | null };

export function sendFormReducer(state: SendFormState, action: SendFormAction): SendFormState {
  switch (action.type) {
    case "reset":
      return createInitialSendFormState();
    case "setMode":
      return { ...state, mode: action.mode, error: null };
    case "setSingleAddress":
      return { ...state, singleAddress: action.address };
    case "setSingleAmount":
      return { ...state, singleAmount: action.amount };
    case "setRows":
      return { ...state, rows: action.rows };
    case "addRow":
      return { ...state, rows: [...state.rows, newRecipientRow()] };
    case "removeRow":
      return {
        ...state,
        rows: state.rows.filter((r) => r.id !== action.id),
      };
    case "updateRow":
      return {
        ...state,
        rows: state.rows.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "reviewReady":
      return {
        ...state,
        review: action.review,
        step: "review",
        error: null,
      };
    case "backToCompose":
      return { ...state, step: "compose", error: null };
    case "confirmStarted":
      return { ...state, confirming: true, error: null };
    case "confirmFinished":
      return { ...state, confirming: false };
    case "confirmSucceeded":
      return { ...state, step: "success", confirming: false };
    case "setError":
      return { ...state, error: action.error };
    default:
      return state;
  }
}
