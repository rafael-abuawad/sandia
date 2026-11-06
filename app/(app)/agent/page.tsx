"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, BrainCircuit } from "lucide-react";
import {
  AgentMascot,
  type AgentMascotHandle,
  type AgentMascotMood,
} from "@/components/agent-mascot";
import { CreateRequestForm } from "@/components/create-request-form";
import { SendForm } from "@/components/send-form";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive-dialog";
import { api } from "@/convex/_generated/api";
import {
  MAX_AGENT_PROMPT_LENGTH,
  extractExplicitAmount,
  resolveBatchRecipients,
  resolveExplicitAddress,
  resolveNamedContact,
  type IntentAction,
  type IntentRouting,
} from "@/lib/agent-intent";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

const EXAMPLES = [
  "Send 100 USDC to Marco",
  "Send 25 USDC to Priya and 25 USDC to Tom",
  "Request 50 USDC from Olivia",
] as const;

const ACTION_LABELS: Record<string, string> = {
  send: "Send USDC",
  batch_send: "Send to multiple people",
  request: "Create a payment request",
};

type AgentOperation = {
  id: number;
  action: IntentAction;
  amount: string;
  address: string;
  ambiguousRecipient: boolean;
  recipients: Array<{ address: string; amount: string }>;
};

export default function AgentPage() {
  const { isSignedIn } = useSignedInWallet();
  const resolveIntent = useAction(api.agent.resolveIntent);
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const [prompt, setPrompt] = useState("");
  const [routing, setRouting] = useState<IntentRouting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<AgentOperation | null>(null);
  const [operationPending, setOperationPending] = useState(false);
  const [intentFocused, setIntentFocused] = useState(false);
  const mascot = useRef<AgentMascotHandle>(null);
  const requestId = useRef(0);
  const nextOperationId = useRef(0);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const openOperation = useCallback(
    (action: IntentAction, userPrompt: string) => {
      const amount = extractExplicitAmount(userPrompt) ?? "";
      const contactList = (contacts ?? []).map(({ name, address }) => ({ name, address }));
      const namedRecipient = resolveNamedContact(userPrompt, contactList);
      const explicitAddress = resolveExplicitAddress(userPrompt);
      const recipients =
        action === "batch_send" ? resolveBatchRecipients(userPrompt, contactList) : [];
      setOperation({
        id: ++nextOperationId.current,
        action,
        amount,
        address: explicitAddress || namedRecipient.address,
        ambiguousRecipient: namedRecipient.ambiguous,
        recipients,
      });
      setRouting(null);
    },
    [contacts],
  );

  async function submitIntent(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setRouting(null);
    if (!isSignedIn) {
      setError("Sign in to continue with an intent.");
      return;
    }
    if (!prompt.trim()) {
      setError("Describe one operation to continue.");
      return;
    }
    if (prompt.length > MAX_AGENT_PROMPT_LENGTH) {
      setError(`Keep your intent under ${MAX_AGENT_PROMPT_LENGTH} characters.`);
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const result = await resolveIntent({ prompt: prompt.trim() });
      if (currentRequest !== requestId.current) return;
      if (result.status === "resolved") openOperation(result.action, prompt);
      else setRouting(result);
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(
          cause instanceof Error
            ? cause.message.replace(/^Uncaught Error: /, "")
            : "AI Agent could not read that intent. Try again.",
        );
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  const selectableActions =
    routing?.status === "choose"
      ? Object.entries(routing.probabilities)
          .filter(([actionName]) => actionName !== "unsupported" && actionName in ACTION_LABELS)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
      : [];
  const mascotMood: AgentMascotMood = loading ? "thinking" : intentFocused ? "attentive" : "idle";

  return (
    <div className="pr-page mx-auto w-full max-w-2xl gap-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
            <BrainCircuit className="size-6" strokeWidth={1.5} aria-hidden />
          </span>
          <div>
            <h1 className="pr-display text-2xl">AI Agent</h1>
            <p className="text-sm text-muted">Describe what you want to do with USDC.</p>
          </div>
        </div>
      </header>
      <AgentMascot ref={mascot} mood={mascotMood} className="pr-animate-in" />
      <form onSubmit={submitIntent} className="space-y-3" noValidate>
        <div className="space-y-2">
          <Label htmlFor="agent-intent">Your intent</Label>
          <Textarea
            id="agent-intent"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              mascot.current?.noticeTyping();
            }}
            onFocus={() => setIntentFocused(true)}
            onBlur={() => setIntentFocused(false)}
            placeholder="For example, “Send 100 USDC to Marco”"
            maxLength={MAX_AGENT_PROMPT_LENGTH}
            aria-describedby={error ? "agent-error" : "agent-hint"}
            aria-invalid={Boolean(error) || undefined}
            rows={4}
            disabled={loading}
          />
          <p id="agent-hint" className="flex justify-between gap-3 text-xs text-muted">
            <span>AI Agent prepares a form for you to review. It never submits a transaction.</span>
            <span className="shrink-0">
              {prompt.length}/{MAX_AGENT_PROMPT_LENGTH}
            </span>
          </p>
        </div>
        {!isSignedIn ? (
          <div className="flex flex-col items-center gap-3">
            <LoginButton />
            <p className="text-center text-sm text-muted">Sign in to prepare an operation.</p>
          </div>
        ) : (
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Preparing…" : "Continue"}
            <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        )}
        {error ? (
          <p id="agent-error" className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <section className="space-y-3" aria-labelledby="agent-examples-title">
        <h2 id="agent-examples-title" className="pr-kicker">
          Try an example
        </h2>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setPrompt(example);
                setError(null);
                mascot.current?.bounce();
              }}
            >
              {example}
            </Button>
          ))}
        </div>
      </section>
      {loading ? (
        <p className="text-sm text-muted" role="status">
          Checking your intent…
        </p>
      ) : null}
      {routing?.status === "unsupported" ? (
        <p
          className="rounded-lg border border-border bg-panel p-4 text-sm text-muted"
          role="status"
        >
          {routing.reason}
        </p>
      ) : null}
      {routing?.status === "choose" ? (
        <section className="space-y-3" aria-labelledby="agent-choose-title">
          <div className="space-y-1">
            <h2 id="agent-choose-title" className="pr-display text-base">
              Which operation did you mean?
            </h2>
            <p className="text-sm text-muted">
              Choose the closest match. You’ll review the details before continuing.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectableActions.map(([actionName, probability]) => (
              <Button
                key={actionName}
                type="button"
                variant="outline"
                className="h-auto min-h-12 justify-between whitespace-normal text-start"
                onClick={() => openOperation(actionName as IntentAction, prompt)}
              >
                <span>{ACTION_LABELS[actionName]}</span>
                <span className="pr-mono text-xs text-muted">{Math.round(probability * 100)}%</span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}
      {operation ? (
        <OperationDialog
          key={operation.id}
          operation={operation}
          onPendingChange={setOperationPending}
          operationPending={operationPending}
          open={true}
          onOpenChange={(open) => {
            if (!open && !operationPending) setOperation(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OperationDialog({
  operation,
  onPendingChange,
  operationPending,
  open,
  onOpenChange,
}: {
  operation: AgentOperation;
  onPendingChange: (pending: boolean) => void;
  operationPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = ACTION_LABELS[operation.action];
  const isSend = operation.action === "send" || operation.action === "batch_send";
  const isRequest = operation.action === "request";
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[90dvh] flex-col overflow-clip sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Check the details and complete the operation in the form below.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pbe-4">
          {operation.ambiguousRecipient ? (
            <p className="rounded-md border border-border p-3 text-sm text-muted" role="status">
              More than one saved contact has this name. Choose the right recipient in the address
              book.
            </p>
          ) : null}
          {isSend ? (
            <SendForm
              initialValues={
                operation.action === "batch_send"
                  ? { recipients: operation.recipients }
                  : { address: operation.address, amount: operation.amount }
              }
              onPendingChange={onPendingChange}
            />
          ) : null}
          {isRequest ? (
            <CreateRequestForm
              initialAmount={operation.amount}
              embeddedPresentation
              onPendingChange={onPendingChange}
            />
          ) : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter className="shrink-0 border-bs border-border bg-panel-elevated pbs-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={operationPending}
            onClick={() => onOpenChange(false)}
          >
            {operationPending ? "Operation in progress…" : "Close"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
