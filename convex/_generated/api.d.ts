/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysis from "../analysis.js";
import type * as authors from "../authors.js";
import type * as concepts from "../concepts.js";
import type * as crons from "../crons.js";
import type * as digests from "../digests.js";
import type * as feedback from "../feedback.js";
import type * as follows from "../follows.js";
import type * as lib_users from "../lib/users.js";
import type * as posts from "../posts.js";
import type * as users from "../users.js";
import type * as x from "../x.js";
import type * as xUsage from "../xUsage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analysis: typeof analysis;
  authors: typeof authors;
  concepts: typeof concepts;
  crons: typeof crons;
  digests: typeof digests;
  feedback: typeof feedback;
  follows: typeof follows;
  "lib/users": typeof lib_users;
  posts: typeof posts;
  users: typeof users;
  x: typeof x;
  xUsage: typeof xUsage;
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
