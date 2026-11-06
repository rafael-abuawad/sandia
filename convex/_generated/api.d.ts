/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agent from "../agent.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_settlement from "../lib/settlement.js";
import type * as lib_walletClaim from "../lib/walletClaim.js";
import type * as migrations from "../migrations.js";
import type * as nearIntents from "../nearIntents.js";
import type * as paymentRequests from "../paymentRequests.js";
import type * as sends from "../sends.js";
import type * as sendsActions from "../sendsActions.js";
import type * as settlement from "../settlement.js";
import type * as settlementAttempts from "../settlementAttempts.js";
import type * as sponsorUsage from "../sponsorUsage.js";
import type * as stellarSponsor from "../stellarSponsor.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agent: typeof agent;
  contacts: typeof contacts;
  crons: typeof crons;
  "lib/auth": typeof lib_auth;
  "lib/settlement": typeof lib_settlement;
  "lib/walletClaim": typeof lib_walletClaim;
  migrations: typeof migrations;
  nearIntents: typeof nearIntents;
  paymentRequests: typeof paymentRequests;
  sends: typeof sends;
  sendsActions: typeof sendsActions;
  settlement: typeof settlement;
  settlementAttempts: typeof settlementAttempts;
  sponsorUsage: typeof sponsorUsage;
  stellarSponsor: typeof stellarSponsor;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
