import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getOrCreateUser, requireUser } from "./lib/users";

export const scheduleWeeklyForAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    for (const user of users) {
      await ctx.db.insert("digests", {
        userId: user._id,
        sendAt: now,
        status: "scheduled",
        createdAt: now,
      });
    }
  },
});

export const listMyDigests = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    return ctx.db
      .query("digests")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
  },
});

export const setDigestStatus = mutation({
  args: {
    digestId: v.id("digests"),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.digestId, {
      status: args.status,
    });
  },
});

export const scheduleMyDigest = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await getOrCreateUser(ctx);
    const now = Date.now();
    return ctx.db.insert("digests", {
      userId: user._id,
      sendAt: now,
      status: "scheduled",
      createdAt: now,
    });
  },
});
