import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getOrCreateUser } from "./lib/users";

export const submitFeedback = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    vote: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { user } = await getOrCreateUser(ctx);
    const existing = await ctx.db
      .query("feedback")
      .withIndex("byUserAndSuggestion", (q) =>
        q.eq("userId", user._id).eq("suggestionId", args.suggestionId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        vote: args.vote,
      });
      return { status: "updated" };
    }

    await ctx.db.insert("feedback", {
      userId: user._id,
      suggestionId: args.suggestionId,
      vote: args.vote,
      createdAt: Date.now(),
    });

    return { status: "created" };
  },
});
