import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    plan: v.string(),
    createdAt: v.number(),
  }).index("byAuthId", ["authId"]),
  authors: defineTable({
    handle: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("byHandle", ["handle"]),
  posts: defineTable({
    userId: v.id("users"),
    authorId: v.optional(v.id("authors")),
    authorHandle: v.optional(v.string()),
    text: v.string(),
    url: v.optional(v.string()),
    source: v.optional(v.union(v.literal("manual"), v.literal("x"))),
    status: v.union(
      v.literal("pending"),
      v.literal("analyzed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byStatus", ["status"]),
  concepts: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    aliases: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("pending")),
    embedding: v.optional(v.array(v.number())),
    createdAt: v.number(),
  })
    .index("byName", ["name"])
    .index("byStatus", ["status"]),
  suggestions: defineTable({
    postId: v.id("posts"),
    conceptId: v.id("concepts"),
    score: v.number(),
    rationale: v.string(),
    createdAt: v.number(),
  })
    .index("byPost", ["postId"])
    .index("byConcept", ["conceptId"]),
  follows: defineTable({
    userId: v.id("users"),
    targetType: v.union(v.literal("concept"), v.literal("author")),
    targetId: v.union(v.id("concepts"), v.id("authors")),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndTarget", ["userId", "targetType", "targetId"]),
  feedback: defineTable({
    userId: v.id("users"),
    suggestionId: v.id("suggestions"),
    vote: v.union(v.literal("up"), v.literal("down")),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserAndSuggestion", ["userId", "suggestionId"])
    .index("bySuggestion", ["suggestionId"]),
  digests: defineTable({
    userId: v.id("users"),
    sendAt: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byStatus", ["status"]),
});
