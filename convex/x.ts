"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const X_API_BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 50;

class XApiError extends Error {
  status: number;
  resetAt?: number | null;

  constructor(status: number, message: string, resetAt?: number | null) {
    super(message);
    this.status = status;
    this.resetAt = resetAt ?? null;
  }
}

function extractTweetId(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "x.com" && host !== "twitter.com") {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const statusIndex = parts.indexOf("status");
  if (statusIndex >= 0 && parts[statusIndex + 1]) {
    return parts[statusIndex + 1];
  }

  if (parts[0] === "i" && parts[1] === "web" && parts[2] === "status") {
    return parts[3] ?? null;
  }

  return null;
}

async function fetchTweet(tweetId: string) {
  if (!X_API_BEARER_TOKEN) {
    throw new Error("X API is not configured. Set X_API_BEARER_TOKEN.");
  }

  const response = await fetch(
    `https://api.x.com/2/tweets/${tweetId}?expansions=author_id&user.fields=username`,
    {
      headers: {
        Authorization: `Bearer ${X_API_BEARER_TOKEN}`,
      },
    },
  );

  const resetHeader = response.headers.get("x-rate-limit-reset");
  const resetAt = resetHeader ? Number(resetHeader) * 1000 : null;

  if (!response.ok) {
    if (response.status === 429) {
      throw new XApiError(
        429,
        "X API rate limited. Try again later or paste the post text instead.",
        resetAt,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new XApiError(
        response.status,
        "X API credentials rejected. Check X_API_BEARER_TOKEN.",
        resetAt,
      );
    }
    const body = await response.text();
    throw new XApiError(
      response.status,
      `X API error (${response.status}): ${body}`,
      resetAt,
    );
  }

  const payload = await response.json();
  const text = payload?.data?.text;
  if (!text) {
    throw new Error("X API returned no post text.");
  }

  const authorHandle = payload?.includes?.users?.[0]?.username ?? null;
  return { text, authorHandle, resetAt };
}

type ImportPostResponse = {
  postId: Id<"posts">;
  text: string;
  authorHandle: string | null;
};

export const importPost = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<ImportPostResponse> => {
    const tweetId = extractTweetId(args.url);
    if (!tweetId) {
      throw new Error("Unsupported X URL.");
    }

    const cached = await ctx.runQuery(
      internal.posts.getCachedAnalysisByUrl,
      { url: args.url },
    );
    if (cached) {
      const postId: Id<"posts"> = await ctx.runMutation(
        internal.posts.createPostInternal,
        {
          text: cached.post.text,
          url: args.url,
          source: "x",
          authorHandle: cached.authorHandle ?? undefined,
        },
      );

      await ctx.runMutation(internal.posts.applyAnalysis, {
        postId,
        authorId: cached.post.authorId ?? undefined,
        suggestions: cached.suggestions.map((item) => ({
          conceptId: item.conceptId,
          score: item.score,
          rationale: item.rationale,
        })),
      });

      return {
        postId,
        text: cached.post.text,
        authorHandle: cached.authorHandle,
      };
    }

    const since = Date.now() - RATE_WINDOW_MS;
    const usage = await ctx.runQuery(internal.xUsage.countRecent, { since });
    if (usage.total >= RATE_LIMIT) {
      throw new Error(
        "X API limit reached for this 15 minute window. Try again later or paste the post text instead.",
      );
    }

    try {
      const { text, authorHandle, resetAt } = await fetchTweet(tweetId);
      const postId: Id<"posts"> = await ctx.runMutation(
        internal.posts.createPostInternal,
        {
          text,
          url: args.url,
          source: "x",
          authorHandle: authorHandle ?? undefined,
        },
      );

      await ctx.runMutation(internal.xUsage.logRequest, {
        endpoint: "tweets.lookup",
        tweetId,
        status: "ok",
        responseStatus: 200,
        resetAt: resetAt ?? undefined,
      });

      return { postId, text, authorHandle };
    } catch (error) {
      if (error instanceof XApiError) {
        await ctx.runMutation(internal.xUsage.logRequest, {
          endpoint: "tweets.lookup",
          tweetId,
          status: error.status === 429 ? "rate_limited" : "error",
          responseStatus: error.status,
          message: error.message,
          resetAt: error.resetAt ?? undefined,
        });
      }
      throw error;
    }
  },
});
