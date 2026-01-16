import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const getByHandle = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("authors")
      .withIndex("byHandle", (q) => q.eq("handle", args.handle))
      .unique();
  },
});

export const upsertAuthor = internalMutation({
  args: {
    handle: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("authors")
      .withIndex("byHandle", (q) => q.eq("handle", args.handle))
      .unique();
    if (existing) {
      return existing._id;
    }
    return ctx.db.insert("authors", {
      handle: args.handle,
      displayName: args.displayName,
      createdAt: Date.now(),
    });
  },
});

export const getAuthor = query({
  args: { authorId: v.id("authors") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.authorId);
  },
});
