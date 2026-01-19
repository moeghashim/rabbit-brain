"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { Buffer } from "node:buffer";

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

function extractAuthorHandle(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const statusIndex = parts.indexOf("status");
  if (statusIndex > 0) {
    return parts[statusIndex - 1] ?? null;
  }
  return null;
}

const CAPTURE_SERVICE_URL = process.env.CAPTURE_SERVICE_URL;
const CAPTURE_SERVICE_TOKEN = process.env.CAPTURE_SERVICE_TOKEN;

type CaptureResponse = {
  text: string;
  screenshotBase64?: string | null;
  authorHandle?: string | null;
};

async function capturePost(url: string, screenshotOnly = false) {
  if (!CAPTURE_SERVICE_URL) {
    throw new Error(
      "Capture service not configured. Set CAPTURE_SERVICE_URL.",
    );
  }

  const response = await fetch(CAPTURE_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CAPTURE_SERVICE_TOKEN
        ? { Authorization: `Bearer ${CAPTURE_SERVICE_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ url, screenshotOnly }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Capture service error (${response.status}): ${body || "Unknown error"}`,
    );
  }

  const payload = (await response.json()) as CaptureResponse;
  return {
    text: payload.text ?? "",
    screenshotBase64: payload.screenshotBase64 ?? null,
    authorHandle: payload.authorHandle ?? null,
  };
}

type ImportPostResponse = {
  postId: Id<"posts">;
  text: string;
  authorHandle: string | null;
};

export const importPost = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<ImportPostResponse> => {
    if (!extractTweetId(args.url)) {
      throw new Error("Unsupported X URL.");
    }

    const cached = await ctx.runQuery(
      internal.posts.getCachedAnalysisByUrl,
      { url: args.url },
    );
    if (cached) {
      let screenshotId = cached.post.screenshotId ?? undefined;
      if (!screenshotId) {
        try {
          const capture = await capturePost(args.url, true);
          if (capture.screenshotBase64) {
            const image = Buffer.from(capture.screenshotBase64, "base64");
            const blob = new Blob([image], { type: "image/png" });
            screenshotId = await ctx.storage.store(blob);
          }
        } catch {
          // If capture fails, fall back to cached text without screenshot.
        }
      }

      const postId: Id<"posts"> = await ctx.runMutation(
        internal.posts.createPostInternal,
        {
          text: cached.post.text,
          url: args.url,
          source: "x",
          authorHandle: cached.authorHandle ?? undefined,
          screenshotId,
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
    const { text, screenshotBase64, authorHandle } = await capturePost(
      args.url,
    );
    if (!text) {
      throw new Error("No post text found from browser capture.");
    }
    let screenshotId: Id<"_storage"> | undefined;
    if (screenshotBase64) {
      const image = Buffer.from(screenshotBase64, "base64");
      const blob = new Blob([image], { type: "image/png" });
      screenshotId = await ctx.storage.store(blob);
    }

    const postId: Id<"posts"> = await ctx.runMutation(
      internal.posts.createPostInternal,
      {
        text,
        url: args.url,
        source: "x",
        screenshotId,
        authorHandle: authorHandle ?? extractAuthorHandle(args.url) ?? undefined,
      },
    );

    return {
      postId,
      text,
      authorHandle: authorHandle ?? extractAuthorHandle(args.url),
    };
  },
});
