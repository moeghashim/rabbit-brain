import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOrCreateUser, requireUser } from "./lib/users";

export const toggleFollow = mutation({
  args: {
    targetType: v.union(v.literal("concept"), v.literal("author")),
    targetId: v.union(v.id("concepts"), v.id("authors")),
  },
  handler: async (ctx, args) => {
    const { user } = await getOrCreateUser(ctx);
    const existing = await ctx.db
      .query("follows")
      .withIndex("byUserAndTarget", (q) =>
        q
          .eq("userId", user._id)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }

    await ctx.db.insert("follows", {
      userId: user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      createdAt: Date.now(),
    });

    return { following: true };
  },
});

export const listFollows = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    return ctx.db
      .query("follows")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .collect();
  },
});
