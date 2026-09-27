"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, BrainCircuit } from "lucide-react";
import {
  AgentMascot,
  type AgentMascotHandle,
  type AgentMascotMood,
} from "@/components/agent-mascot";
import { StockTradeTicket } from "@/components/stocks/stock-detail";
import { CreateRequestForm } from "@/components/create-request-form";
import { SendForm } from "@/components/send-form";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  extractExplicitAmount,
  extractStockUnit,
  resolveBatchRecipients,
  resolveExplicitAddress,
  resolveNamedContact,
  resolveStock,
  type AgentStock,
  type IntentAction,
  type IntentRouting,
} from "@/lib/agent-intent";
import { useSignedInWallet } from "@/lib/use-signed-in-wallet";

const EXAMPLES = [
  "Send 100 USDG to Marco",
  "Deposit 20 USDG to earn",
  "Swap 20 USDG to NVIDIA",
  "Request 50 USDG from Olivia",
] as const;

const ACTION_LABELS: Record<string, string> = {
  send: "Send USDG",
  batch_send: "Send to multiple people",
  request: "Create a payment request",
  earn_deposit: "Deposit into Earn",
  earn_withdraw: "Withdraw from Earn",
  stock_buy: "Buy a stock token",
  stock_sell: "Sell a stock token",
};

type AgentOperation = {
  id: number;
  action: IntentAction;
  amount: string;
  address: string;
  ambiguousRecipient: boolean;
  recipients: Array<{ address: string; amount: string }>;
  stock: AgentStock | null;
  stockUnit: "usd" | "shares" | null;
};

export default function AgentPage() {
  const { isSignedIn } = useSignedInWallet();
  const resolveIntent = useAction(api.agent.resolveIntent);
  const contacts = useQuery(api.contacts.list, isSignedIn ? {} : "skip");
  const [prompt, setPrompt] = useState("");
  const [routing, setRouting] = useState<IntentRouting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [operation, setOperation] = useState<AgentOperation | null>(null);
  const [operationPending, setOperationPending] = useState(false);
  const [stocks, setStocks] = useState<AgentStock[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);
  const [intentFocused, setIntentFocused] = useState(false);
  const mascot = useRef<AgentMascotHandle>(null);
  const requestId = useRef(0);
  const nextOperationId = useRef(0);
  const stocksPromise = useRef<Promise<AgentStock[]> | null>(null);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const loadStocks = useCallback(async () => {
    if (stocks.length) return stocks;
    if (!stocksPromise.current) {
      stocksPromise.current = fetch("/api/rhj/assets")
        .then(async (response) => {
          if (!response.ok) throw new Error("Stock assets are unavailable right now.");
          const data = (await response.json()) as { assets?: AgentStock[] };
          if (!Array.isArray(data.assets)) throw new Error("Stock assets could not be loaded.");
          setStocks(data.assets);
          setStockError(null);
          return data.assets;
        })
        .catch((cause: unknown) => {
          stocksPromise.current = null;
          throw cause;
        });
    }
    return stocksPromise.current;
  }, [stocks]);

  const openOperation = useCallback(
    async (action: IntentAction, userPrompt: string) => {
      const requestAtStart = requestId.current;
      const amount = extractExplicitAmount(userPrompt) ?? "";
      const contactList = (contacts ?? []).map(({ name, address }) => ({ name, address }));
      const namedRecipient = resolveNamedContact(userPrompt, contactList);
      const explicitAddress = resolveExplicitAddress(userPrompt);
      const recipients =
        action === "batch_send" ? resolveBatchRecipients(userPrompt, contactList) : [];
      let stock: AgentStock | null = null;
      if (action === "stock_buy" || action === "stock_sell") {
        setStockError(null);
        setOperationLoading(true);
        try {
          stock = resolveStock(userPrompt, await loadStocks());
        } catch (cause) {
          setStockError(
            cause instanceof Error ? cause.message : "Stock assets are unavailable right now.",
          );
        } finally {
          setOperationLoading(false);
        }
      }
      if (requestAtStart !== requestId.current) return;
      setOperation({
        id: ++nextOperationId.current,
        action,
        amount,
        address: explicitAddress || namedRecipient.address,
        ambiguousRecipient: namedRecipient.ambiguous,
        recipients,
        stock,
        stockUnit:
          action === "stock_buy" || action === "stock_sell" ? extractStockUnit(userPrompt) : null,
      });
      setRouting(null);
    },
    [contacts, loadStocks],
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
    if (prompt.length > 2_000) {
      setError("Keep your intent under 2,000 characters.");
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const result = await resolveIntent({ prompt: prompt.trim() });
      if (currentRequest !== requestId.current) return;
      if (result.status === "resolved") await openOperation(result.action, prompt);
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
  const mascotMood: AgentMascotMood =
    loading || operationLoading ? "thinking" : intentFocused ? "attentive" : "idle";

  return (
    <div className="pr-page mx-auto w-full max-w-2xl gap-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
            <BrainCircuit className="size-6" strokeWidth={1.5} aria-hidden />
          </span>
          <div>
            <h1 className="pr-display text-2xl">AI Agent</h1>
            <p className="text-sm text-muted">Describe what you want to do with USDG.</p>
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
            placeholder="For example, “Send 100 USDG to Marco”"
            maxLength={2_000}
            aria-describedby={error ? "agent-error" : "agent-hint"}
            aria-invalid={Boolean(error) || undefined}
            rows={4}
            disabled={loading}
          />
          <p id="agent-hint" className="flex justify-between gap-3 text-xs text-muted">
            <span>AI Agent prepares a form for you to review. It never submits a transaction.</span>
            <span className="shrink-0">{prompt.length}/2000</span>
          </p>
        </div>
        {!isSignedIn ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Sign in to prepare an operation.</p>
            <LoginButton />
          </div>
        ) : (
          <Button type="submit" size="lg" className="w-full" disabled={loading || operationLoading}>
            {loading || operationLoading ? "Preparing…" : "Continue"}
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
      {operationLoading ? (
        <p className="text-sm text-muted" role="status">
          Loading stock tokens…
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
                className="h-auto min-h-12 justify-between whitespace-normal text-left"
                onClick={() => void openOperation(actionName as IntentAction, prompt)}
              >
                <span>{ACTION_LABELS[actionName]}</span>
                <span className="pr-mono text-xs text-muted">{Math.round(probability * 100)}%</span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}
      {stockError && !operation ? (
        <p className="text-sm text-danger" role="status">
          {stockError}
        </p>
      ) : null}
      {operation ? (
        <OperationDialog
          key={operation.id}
          operation={operation}
          stockAssets={stocks}
          stockError={stockError}
          onStockChange={(stock) =>
            setOperation((current) => (current ? { ...current, stock } : null))
          }
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
  stockAssets,
  stockError,
  onStockChange,
  onPendingChange,
  operationPending,
  open,
  onOpenChange,
}: {
  operation: AgentOperation;
  stockAssets: AgentStock[];
  stockError: string | null;
  onStockChange: (stock: AgentStock) => void;
  onPendingChange: (pending: boolean) => void;
  operationPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = ACTION_LABELS[operation.action];
  const isSend = operation.action === "send" || operation.action === "batch_send";
  const isRequest = operation.action === "request";
  const isEarn = operation.action === "earn_deposit" || operation.action === "earn_withdraw";
  const isStock = operation.action === "stock_buy" || operation.action === "stock_sell";
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Check the details and complete the operation in the form below.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
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
          {isEarn ? (
            <EarnIntentPanel
              action={operation.action === "earn_withdraw" ? "earn_withdraw" : "earn_deposit"}
              amount={operation.amount}
            />
          ) : null}
          {isStock ? (
            <AgentStockPanel
              operation={operation}
              assets={stockAssets}
              error={stockError}
              onStockChange={onStockChange}
            />
          ) : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter className="shrink-0 border-t border-border bg-panel-elevated pt-4">
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

function EarnIntentPanel({
  action,
  amount,
}: {
  action: "earn_deposit" | "earn_withdraw";
  amount: string;
}) {
  const isDeposit = action === "earn_deposit";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agent-earn-amount">Amount (USDG)</Label>
        <Input
          id="agent-earn-amount"
          inputMode="decimal"
          value={amount}
          readOnly
          placeholder="Enter an amount"
        />
      </div>
      <Button type="button" className="w-full" size="lg" disabled>
        {isDeposit ? "Deposit unavailable" : "Withdraw unavailable"}
      </Button>
      <p className="text-sm text-muted" role="status">
        {isDeposit
          ? "Earn deposits stay disabled until the vault accepts USDG deposits."
          : "Withdraw and redeem stay closed until the app can verify a Sandia account receipt."}
      </p>
      <p className="text-xs text-muted">
        Steakhouse USDG is a vault investment. Review the vault disclosures before depositing.
      </p>
    </div>
  );
}

function AgentStockPanel({
  operation,
  assets,
  error,
  onStockChange,
}: {
  operation: AgentOperation;
  assets: AgentStock[];
  error: string | null;
  onStockChange: (stock: AgentStock) => void;
}) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"buy" | "sell">(
    operation.action === "stock_sell" ? "sell" : "buy",
  );
  const [unit, setUnit] = useState<"usd" | "shares" | null>(operation.stockUnit);
  const [amount, setAmount] = useState(operation.amount);
  const visibleAssets = assets
    .filter((asset) =>
      [asset.symbol, asset.shortName].join(" ").toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);
  return (
    <div className="space-y-4">
      {!operation.stock ? (
        <div className="space-y-2">
          <Label htmlFor="agent-stock-search">Choose a Robinhood stock token</Label>
          <Input
            id="agent-stock-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol or name"
          />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Matching stock tokens">
            {visibleAssets.map((asset) => (
              <li key={asset.contractAddress}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start py-2 text-left"
                  onClick={() => onStockChange(asset)}
                >
                  <span className="pr-mono w-16 shrink-0">{asset.symbol}</span>
                  <span className="truncate text-muted">{asset.shortName}</span>
                </Button>
              </li>
            ))}
            {visibleAssets.length === 0 ? (
              <li className="p-2 text-sm text-muted">No matching stock tokens.</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          <span className="pr-mono font-semibold">{operation.stock.symbol}</span>
          <span className="ml-2 text-muted">{operation.stock.shortName}</span>
        </div>
      )}
      {unit === null ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">What does the amount refer to?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={false}
              onClick={() => setUnit("usd")}
            >
              USD
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={false}
              onClick={() => setUnit("shares")}
            >
              Shares
            </Button>
          </div>
        </div>
      ) : null}
      {unit !== null ? (
        <StockTradeTicket
          symbol={operation.stock?.symbol ?? "stock"}
          halted={false}
          side={side}
          onSideChange={setSide}
          unit={unit}
          onUnitChange={setUnit}
          ticketAmount={amount}
          onTicketAmountChange={setAmount}
          tradeReason="Trading stays disabled until a firm quote reports liquidity."
          estimate={null}
          embeddedPresentation
        />
      ) : null}
    </div>
  );
}
