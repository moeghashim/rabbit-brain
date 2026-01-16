import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const upsertConcept = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    aliases: v.array(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("pending"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("concepts")
      .withIndex("byName", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      return existing._id;
    }
    return ctx.db.insert("concepts", {
      name: args.name,
      description: args.description,
      aliases: args.aliases,
      status: args.status ?? "active",
      createdAt: Date.now(),
    });
  },
});

export const upsertConcepts = internalMutation({
  args: {
    concepts: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        aliases: v.array(v.string()),
        status: v.optional(v.union(v.literal("active"), v.literal("pending"))),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const concept of args.concepts) {
      const existing = await ctx.db
        .query("concepts")
        .withIndex("byName", (q) => q.eq("name", concept.name))
        .unique();
      if (existing) {
        ids.push(existing._id);
        continue;
      }
      const conceptId = await ctx.db.insert("concepts", {
        name: concept.name,
        description: concept.description,
        aliases: concept.aliases,
        status: concept.status ?? "active",
        createdAt: Date.now(),
      });
      ids.push(conceptId);
    }
    return ids;
  },
});

export const listConcepts = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("concepts")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
  },
});
