/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiFunctions from "../aiFunctions.js";
import type * as auth from "../auth.js";
import type * as clarity from "../clarity.js";
import type * as clarityAgent from "../clarityAgent.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as mindMovies from "../mindMovies.js";
import type * as notifications from "../notifications.js";
import type * as renderWebhook from "../renderWebhook.js";
import type * as streaks from "../streaks.js";
import type * as tracking from "../tracking.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiFunctions: typeof aiFunctions;
  auth: typeof auth;
  clarity: typeof clarity;
  clarityAgent: typeof clarityAgent;
  crons: typeof crons;
  http: typeof http;
  mindMovies: typeof mindMovies;
  notifications: typeof notifications;
  renderWebhook: typeof renderWebhook;
  streaks: typeof streaks;
  tracking: typeof tracking;
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
