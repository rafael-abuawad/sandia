"use client";

import { useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletClient } from "wagmi";
import { privateKeyToAccount } from "viem/accounts";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import {
  builderFeePercent,
  HL_AGENT_NAME,
  HL_BUILDER_ADDRESS,
  HL_BUILDER_FEE_TENTHS_BPS,
  HL_REFERRAL_CODE,
  HL_SIGNATURE_CHAIN_ID,
  orderBuilder,
  HL_SPOT_USDC_TOKEN,
  HL_STOCKS_DEX,
} from "@/lib/hyperliquid/config";
import { hlInfo, info } from "@/lib/hyperliquid/info";
import { fetchMarkets, type Market } from "@/lib/hyperliquid/markets";
import {
  summarizeAccount,
  type AbstractionMode,
  type AccountSummary,
} from "@/lib/hyperliquid/account";
import { createAgent, loadAgent } from "@/lib/hyperliquid/agent-store";
import {
  buildHlActivity,
  fetchHlActivityPage,
  HL_ACTIVITY_LOOKBACK_MS,
} from "@/lib/hyperliquid/activity";
import { parsePortfolio } from "@/lib/hyperliquid/portfolio";
import { closeLimitPx, quoteTicket, type Side } from "@/lib/hyperliquid/math";

const transport = new HttpTransport();

export const hlKeys = {
  markets: ["hl", "markets"] as const,
  account: (user: string) => ["hl", "account", user.toLowerCase()] as const,
  setup: (user: string) => ["hl", "setup", user.toLowerCase()] as const,
  candles: (coin: string, interval: string) => ["hl", "candles", coin, interval] as const,
  activity: (user: string) => ["hl", "activity", user.toLowerCase()] as const,
  portfolio: (user: string) => ["hl", "portfolio", user.toLowerCase()] as const,
};

export function useMarkets() {
  return useQuery({
    queryKey: hlKeys.markets,
    queryFn: fetchMarkets,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useMarket(coin: string): {
  market: Market | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useMarkets();
  const market = useMemo(() => data?.find((item) => item.coin === coin), [data, coin]);
  return { market, isLoading, isError };
}

async function fetchAccount(user: string): Promise<AccountSummary> {
  const [mode, main, stocks, spot] = await Promise.all([
    hlInfo<AbstractionMode>({ type: "userAbstraction", user }).catch(() => "default"),
    info.clearinghouseState(user),
    info.clearinghouseState(user, HL_STOCKS_DEX),
    info.spotClearinghouseState(user),
  ]);
  return summarizeAccount({ mode, perps: [main, stocks], spot });
}

/** Balance and open positions for a HyperCore account. */
export function useHlAccount(user: string | undefined) {
  return useQuery({
    queryKey: hlKeys.account(user ?? ""),
    queryFn: () => fetchAccount(user!),
    enabled: Boolean(user),
    refetchInterval: 5_000,
  });
}

/**
 * Trades and USDC movements, one time window at a time.
 * The first page walks backward until it has a screenful or it reaches the lookback floor.
 */
export function usePagedHlActivity(user: string | undefined) {
  const floors = useRef(new Map<string, number>());
  const userKey = user ?? "";
  if (!floors.current.has(userKey)) {
    floors.current.set(userKey, Date.now() - HL_ACTIVITY_LOOKBACK_MS);
  }
  const floor = floors.current.get(userKey) ?? Date.now() - HL_ACTIVITY_LOOKBACK_MS;

  return useInfiniteQuery({
    queryKey: [...hlKeys.activity(user ?? ""), "pages", floor] as const,
    enabled: Boolean(user),
    initialPageParam: { endTime: null as number | null },
    queryFn: ({ pageParam, signal }) =>
      fetchHlActivityPage(user!, pageParam.endTime ?? Date.now(), floor, signal),
    getNextPageParam: (last) =>
      last.nextEndTime === null ? undefined : { endTime: last.nextEndTime },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Recent trades and USDC movements for the portfolio preview. */
export function useHlActivity(user: string | undefined) {
  return useQuery({
    queryKey: hlKeys.activity(user ?? ""),
    queryFn: async () => {
      const [fills, ledger] = await Promise.all([
        info.userFills(user!),
        info.userNonFundingLedgerUpdates(user!, Date.now() - 90 * 24 * 60 * 60 * 1000),
      ]);
      return buildHlActivity(user!, fills, ledger);
    },
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
}

/** Account value and PnL history for the portfolio chart. */
export function usePortfolioHistory(user: string | undefined) {
  return useQuery({
    queryKey: hlKeys.portfolio(user ?? ""),
    queryFn: async () => parsePortfolio(await hlInfo({ type: "portfolio", user: user! })),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

export type CandleInterval = "1h" | "1d" | "1w" | "1m";

const RANGE: Record<CandleInterval, { interval: string; spanMs: number }> = {
  "1h": { interval: "1m", spanMs: 60 * 60 * 1000 },
  "1d": { interval: "15m", spanMs: 24 * 60 * 60 * 1000 },
  "1w": { interval: "1h", spanMs: 7 * 24 * 60 * 60 * 1000 },
  "1m": { interval: "4h", spanMs: 30 * 24 * 60 * 60 * 1000 },
};

export function useCandles(coin: string, range: CandleInterval) {
  const { interval, spanMs } = RANGE[range];
  return useQuery({
    queryKey: hlKeys.candles(coin, range),
    queryFn: async () => {
      const candles = await info.candleSnapshot(coin, interval, Date.now() - spanMs);
      return candles.map((candle) => ({ t: candle.t, c: Number(candle.c) }));
    },
    refetchInterval: 30_000,
  });
}

export type TradingSetup = {
  /** The browser holds an approved trading key and the builder fee is approved. */
  ready: boolean;
  agentApproved: boolean;
  builderApproved: boolean;
  /** The account already has a referrer, ours or someone else's. */
  referred: boolean;
  unified: boolean;
};

async function fetchSetup(user: string): Promise<TradingSetup> {
  const agent = loadAgent(user);
  const [agents, maxFee, mode, referral] = await Promise.all([
    info.extraAgents(user),
    HL_BUILDER_ADDRESS ? info.maxBuilderFee(user, HL_BUILDER_ADDRESS) : Promise.resolve(0),
    hlInfo<AbstractionMode>({ type: "userAbstraction", user }).catch(() => "default"),
    hlInfo<{ referredBy: { code: string } | null }>({ type: "referral", user }).catch(() => null),
  ]);
  const agentApproved = Boolean(
    agent &&
    agents.some(
      (item) =>
        item.address.toLowerCase() === agent.address.toLowerCase() &&
        (!item.validUntil || item.validUntil > Date.now()),
    ),
  );
  const builderApproved = !HL_BUILDER_ADDRESS || maxFee >= HL_BUILDER_FEE_TENTHS_BPS;
  return {
    ready: agentApproved && builderApproved,
    agentApproved,
    builderApproved,
    // Unknown (null) counts as referred so a failed lookup never retries the action.
    referred: referral ? referral.referredBy !== null : true,
    unified: mode === "unifiedAccount" || mode === "portfolioMargin",
  };
}

function agentClient(user: string): ExchangeClient {
  const agent = loadAgent(user);
  if (!agent) throw new Error("Enable trading first.");
  return new ExchangeClient({ transport, wallet: privateKeyToAccount(agent.privateKey) });
}

/**
 * One-time trading setup. The account wallet signs two approvals: a browser-only trading key
 * (so orders do not need a prompt each time) and Sandia's builder fee. The trading key then
 * moves the account to unified mode so stocks and crypto share one USDC balance.
 */
export function useTradingSetup(user: string | undefined) {
  const queryClient = useQueryClient();
  const { data: walletClient } = useWalletClient();
  const query = useQuery({
    queryKey: hlKeys.setup(user ?? ""),
    queryFn: () => fetchSetup(user!),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const enable = useCallback(async () => {
    if (!user) throw new Error("Sign in to trade.");
    if (!walletClient) throw new Error("Your wallet is still loading. Try again in a moment.");
    const master = new ExchangeClient({
      transport,
      wallet: walletClient,
      signatureChainId: HL_SIGNATURE_CHAIN_ID,
    });
    const current = await fetchSetup(user);
    if (!current.agentApproved) {
      const agent = createAgent(user);
      await master.approveAgent({ agentAddress: agent.address, agentName: HL_AGENT_NAME });
    }
    if (!current.builderApproved && HL_BUILDER_ADDRESS) {
      await master.approveBuilderFee({
        builder: HL_BUILDER_ADDRESS,
        maxFeeRate: builderFeePercent(),
      });
    }
    if (!current.referred && HL_REFERRAL_CODE) {
      try {
        await agentClient(user).setReferrer({ code: HL_REFERRAL_CODE });
      } catch (error) {
        // Hyperliquid refuses once an account has a referrer or too much volume. Trading still works.
        console.warn("hl_set_referrer_failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    if (!current.unified) {
      try {
        await agentClient(user).agentSetAbstraction({ abstraction: "u" });
      } catch (error) {
        // Crypto perps still work without it; stocks need unified margin.
        console.warn("hl_unified_account_failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    await queryClient.invalidateQueries({ queryKey: hlKeys.setup(user) });
    await queryClient.invalidateQueries({ queryKey: hlKeys.account(user) });
  }, [user, walletClient, queryClient]);

  return { ...query, enable, walletReady: Boolean(walletClient) };
}

export type PlacedOrder = { avgPx: number; size: number };

function readFill(statuses: unknown[]): PlacedOrder {
  for (const status of statuses) {
    if (status && typeof status === "object" && "filled" in status) {
      const filled = (status as { filled: { avgPx: string; totalSz: string } }).filled;
      return { avgPx: Number(filled.avgPx), size: Number(filled.totalSz) };
    }
    if (status && typeof status === "object" && "error" in status) {
      throw new Error(String((status as { error: unknown }).error));
    }
  }
  throw new Error("The order did not fill. Try again.");
}

/** Market orders and closes, signed by the browser's trading key, always with Sandia's builder code. */
export function useTrader(user: string | undefined) {
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    if (!user) return;
    await queryClient.invalidateQueries({ queryKey: hlKeys.account(user) });
    await queryClient.invalidateQueries({ queryKey: hlKeys.activity(user) });
  }, [user, queryClient]);

  const open = useCallback(
    async (input: { market: Market; side: Side; marginUsd: number; leverage: number }) => {
      if (!user) throw new Error("Sign in to trade.");
      const { market, side, marginUsd, leverage } = input;
      const quote = quoteTicket({
        side,
        marginUsd,
        leverage,
        markPx: market.markPx,
        szDecimals: market.szDecimals,
        maxLeverage: market.maxLeverage,
      });
      if (!quote) throw new Error("This amount is too small for this market.");
      const client = agentClient(user);
      await client.updateLeverage({
        asset: market.assetId,
        isCross: !market.isolatedOnly,
        leverage,
      });
      const result = await client.order({
        orders: [
          {
            a: market.assetId,
            b: side === "long",
            p: quote.limitPx,
            s: quote.size,
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
        ...orderBuilder(),
      });
      const fill = readFill(result.response.data.statuses);
      await refresh();
      return fill;
    },
    [user, refresh],
  );

  const close = useCallback(
    async (input: { market: Market; size: number }) => {
      if (!user) throw new Error("Sign in to trade.");
      const { market, size } = input;
      const result = await agentClient(user).order({
        orders: [
          {
            a: market.assetId,
            b: size < 0,
            p: closeLimitPx({
              positionSize: size,
              markPx: market.markPx,
              szDecimals: market.szDecimals,
            }),
            s: Math.abs(size).toFixed(market.szDecimals),
            r: true,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
        ...orderBuilder(),
      });
      const fill = readFill(result.response.data.statuses);
      await refresh();
      return fill;
    },
    [user, refresh],
  );

  return { open, close };
}

/** A send that failed partway. `sent` lists the recipients already paid. */
export class PartialSendError extends Error {
  constructor(
    readonly cause: unknown,
    readonly sent: string[],
  ) {
    super(cause instanceof Error ? cause.message : "Send failed");
    this.name = "PartialSendError";
  }
}

/**
 * USDC transfers on HyperCore. They are instant, free, and signed by the account wallet.
 * Unified accounts hold USDC on the spot ledger, so they send with `spotSend`.
 */
export function useUsdcSender(user: string | undefined) {
  const queryClient = useQueryClient();
  const { data: walletClient } = useWalletClient();

  const send = useCallback(
    async (recipients: Array<{ address: `0x${string}`; amount: string }>, unified: boolean) => {
      if (!user) throw new Error("Sign in to send USDC.");
      if (!walletClient) throw new Error("Your wallet is still loading. Try again in a moment.");
      const master = new ExchangeClient({
        transport,
        wallet: walletClient,
        signatureChainId: HL_SIGNATURE_CHAIN_ID,
      });
      const sent: string[] = [];
      try {
        for (const recipient of recipients) {
          if (unified) {
            await master.spotSend({
              destination: recipient.address,
              token: HL_SPOT_USDC_TOKEN,
              amount: recipient.amount,
            });
          } else {
            await master.usdSend({ destination: recipient.address, amount: recipient.amount });
          }
          sent.push(recipient.address);
        }
      } catch (error) {
        throw new PartialSendError(error, sent);
      } finally {
        await queryClient.invalidateQueries({ queryKey: hlKeys.account(user) });
        await queryClient.invalidateQueries({ queryKey: hlKeys.activity(user) });
      }
      return sent;
    },
    [user, walletClient, queryClient],
  );

  return { send, walletReady: Boolean(walletClient) };
}
