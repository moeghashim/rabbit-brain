"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const X_API_BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;

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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X API error (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const text = payload?.data?.text;
  if (!text) {
    throw new Error("X API returned no post text.");
  }

  const authorHandle = payload?.includes?.users?.[0]?.username ?? null;
  return { text, authorHandle };
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

    const { text, authorHandle } = await fetchTweet(tweetId);
    const postId: Id<"posts"> = await ctx.runMutation(
      internal.posts.createPostInternal,
      {
      text,
      url: args.url,
      source: "x",
      authorHandle: authorHandle ?? undefined,
      },
    );

    return { postId, text, authorHandle };
  },
});
