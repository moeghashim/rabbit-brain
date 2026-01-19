import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOrCreateUser, requireUser } from "./lib/users";

export const createPost = mutation({
  args: {
    text: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getOrCreateUser(ctx);
    const postId = await ctx.db.insert("posts", {
      userId: user._id,
      text: args.text,
      url: args.url,
      source: "manual",
      status: "pending",
      createdAt: Date.now(),
    });
    return postId;
  },
});

export const createPostInternal = internalMutation({
  args: {
    text: v.string(),
    url: v.optional(v.string()),
    source: v.optional(v.union(v.literal("manual"), v.literal("x"))),
    authorHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getOrCreateUser(ctx);
    const normalizedHandle = args.authorHandle?.replace(/^@/, "");
    return ctx.db.insert("posts", {
      userId: user._id,
      authorHandle: normalizedHandle,
      text: args.text,
      url: args.url,
      source: args.source,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("byPost", (q) => q.eq("postId", args.postId))
      .collect();
    const suggestionsWithConcepts = await Promise.all(
      suggestions.map(async (suggestion) => {
        const concept = await ctx.db.get(suggestion.conceptId);
        return {
          suggestion,
          concept,
        };
      }),
    );
    return { post, suggestions: suggestionsWithConcepts };
  },
});

export const listUserPosts = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    return ctx.db
      .query("posts")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
  },
});

export const listFeed = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    const follows = await ctx.db
      .query("follows")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .collect();
    if (follows.length === 0) {
      return [];
    }

    const conceptIds = new Set<Id<"concepts">>(
      follows
        .filter((follow) => follow.targetType === "concept")
        .map((follow) => follow.targetId as Id<"concepts">),
    );
    const authorIds = new Set<Id<"authors">>(
      follows
        .filter((follow) => follow.targetType === "author")
        .map((follow) => follow.targetId as Id<"authors">),
    );

    const posts = await ctx.db.query("posts").order("desc").take(50);
    const feed = [] as {
      post: typeof posts[number];
      suggestions: Array<{
        conceptId: string;
        name: string;
        score: number;
        rationale: string;
      }>;
      matchedAuthor: boolean;
      authorHandle: string | null;
    }[];

    for (const post of posts) {
      const matchedAuthor = !!post.authorId && authorIds.has(post.authorId);
      const author = post.authorId ? await ctx.db.get(post.authorId) : null;
      const suggestions = await ctx.db
        .query("suggestions")
        .withIndex("byPost", (q) => q.eq("postId", post._id))
        .collect();
      const matchedSuggestions = suggestions.filter((suggestion) =>
        conceptIds.has(suggestion.conceptId),
      );
      const suggestionsWithNames = await Promise.all(
        matchedSuggestions.map(async (suggestion) => {
          const concept = await ctx.db.get(suggestion.conceptId);
          return {
            conceptId: suggestion.conceptId,
            name: concept?.name ?? "Unknown concept",
            score: suggestion.score,
            rationale: suggestion.rationale,
          };
        }),
      );

      if (matchedAuthor || suggestionsWithNames.length > 0) {
        feed.push({
          post,
          suggestions: suggestionsWithNames,
          matchedAuthor,
          authorHandle: author?.handle ?? post.authorHandle ?? null,
        });
      }
    }

    return feed;
  },
});

export const getPostForAnalysis = internalQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.postId);
  },
});

export const getCachedAnalysisByUrl = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("byUrl", (q) => q.eq("url", args.url))
      .order("desc")
      .first();

    if (!post || post.status !== "analyzed") {
      return null;
    }

    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("byPost", (q) => q.eq("postId", post._id))
      .collect();

    if (suggestions.length === 0) {
      return null;
    }

    let authorHandle = post.authorHandle ?? null;
    if (!authorHandle && post.authorId) {
      const author = await ctx.db.get(post.authorId);
      authorHandle = author?.handle ?? null;
    }

    return { post, suggestions, authorHandle };
  },
});

export const applyAnalysis = internalMutation({
  args: {
    postId: v.id("posts"),
    authorId: v.optional(v.id("authors")),
    suggestions: v.array(
      v.object({
        conceptId: v.id("concepts"),
        score: v.number(),
        rationale: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const suggestion of args.suggestions) {
      await ctx.db.insert("suggestions", {
        postId: args.postId,
        conceptId: suggestion.conceptId,
        score: suggestion.score,
        rationale: suggestion.rationale,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.postId, {
      authorId: args.authorId,
      status: "analyzed",
    });
  },
});

export const markFailed = internalMutation({
  args: { postId: v.id("posts"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, {
      status: "failed",
    });
    if (args.reason) {
      await ctx.db.insert("suggestions", {
        postId: args.postId,
        conceptId: await ctx.db.insert("concepts", {
          name: "Analysis failed",
          description: args.reason,
          aliases: [],
          status: "pending",
          createdAt: Date.now(),
        }),
        score: 0,
        rationale: "Analysis failed",
        createdAt: Date.now(),
      });
    }
  },
});
