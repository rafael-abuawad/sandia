/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as across from "../across.js";
import type * as activity from "../activity.js";
import type * as agent from "../agent.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as directSettlement from "../directSettlement.js";
import type * as lib_acrossDeposit from "../lib/acrossDeposit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_depositLog from "../lib/depositLog.js";
import type * as lib_fillProof from "../lib/fillProof.js";
import type * as lib_transferLog from "../lib/transferLog.js";
import type * as lib_walletClaim from "../lib/walletClaim.js";
import type * as outbound from "../outbound.js";
import type * as outboundActions from "../outboundActions.js";
import type * as paymentAttempts from "../paymentAttempts.js";
import type * as paymentRequests from "../paymentRequests.js";
import type * as users from "../users.js";
import type * as vault from "../vault.js";
import type * as vaultActivity from "../vaultActivity.js";
import type * as vaultActivityActions from "../vaultActivityActions.js";
import type * as zerox from "../zerox.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  across: typeof across;
  activity: typeof activity;
  agent: typeof agent;
  contacts: typeof contacts;
  crons: typeof crons;
  directSettlement: typeof directSettlement;
  "lib/acrossDeposit": typeof lib_acrossDeposit;
  "lib/auth": typeof lib_auth;
  "lib/depositLog": typeof lib_depositLog;
  "lib/fillProof": typeof lib_fillProof;
  "lib/transferLog": typeof lib_transferLog;
  "lib/walletClaim": typeof lib_walletClaim;
  outbound: typeof outbound;
  outboundActions: typeof outboundActions;
  paymentAttempts: typeof paymentAttempts;
  paymentRequests: typeof paymentRequests;
  users: typeof users;
  vault: typeof vault;
  vaultActivity: typeof vaultActivity;
  vaultActivityActions: typeof vaultActivityActions;
  zerox: typeof zerox;
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
