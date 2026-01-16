import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 50;

export const logRequest = internalMutation({
  args: {
    endpoint: v.string(),
    tweetId: v.optional(v.string()),
    status: v.union(
      v.literal("ok"),
      v.literal("rate_limited"),
      v.literal("error"),
    ),
    responseStatus: v.optional(v.number()),
    message: v.optional(v.string()),
    resetAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("xRequests", {
      endpoint: args.endpoint,
      tweetId: args.tweetId,
      status: args.status,
      responseStatus: args.responseStatus,
      message: args.message,
      resetAt: args.resetAt,
      createdAt: Date.now(),
    });
  },
});

export const countRecent = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("xRequests")
      .withIndex("byCreatedAt", (q) => q.gte("createdAt", args.since))
      .collect();
    const lastResetAt =
      requests.reduce(
        (max, item) => (item.resetAt && item.resetAt > max ? item.resetAt : max),
        0,
      ) || null;
    return { total: requests.length, lastResetAt };
  },
});

export const getUsage = query({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const since = args.now - RATE_WINDOW_MS;
    const requests = await ctx.db
      .query("xRequests")
      .withIndex("byCreatedAt", (q) => q.gte("createdAt", since))
      .collect();
    const rateLimited = requests.filter(
      (item) => item.status === "rate_limited",
    ).length;
    const lastResetAt =
      requests.reduce(
        (max, item) => (item.resetAt && item.resetAt > max ? item.resetAt : max),
        0,
      ) || null;
    return {
      windowMinutes: RATE_WINDOW_MS / 60000,
      limit: RATE_LIMIT,
      total: requests.length,
      rateLimited,
      remaining: Math.max(0, RATE_LIMIT - requests.length),
      lastResetAt,
    };
  },
});
