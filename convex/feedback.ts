import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

export const listDownvotedConceptNames = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const feedback = await ctx.db
      .query("feedback")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("vote"), "down"))
      .take(limit);

    const names = new Set<string>();
    await Promise.all(
      feedback.map(async (item) => {
        const suggestion = await ctx.db.get(item.suggestionId);
        if (!suggestion) return;
        const concept = await ctx.db.get(
          suggestion.conceptId as Id<"concepts">,
        );
        if (concept?.name) {
          names.add(concept.name);
        }
      }),
    );

    return Array.from(names).slice(0, limit);
  },
});
