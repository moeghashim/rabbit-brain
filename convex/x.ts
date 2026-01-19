"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

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

const execFileAsync = promisify(execFile);

async function runAgentBrowser(args: string[]) {
  const { stdout } = await execFileAsync("agent-browser", args, {
    timeout: 60000,
  });
  return stdout.trim();
}

function parseAgentJson(output: string) {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

async function capturePost(url: string) {
  const session = `rb-${randomUUID()}`;
  const screenshotPath = path.join("/tmp", `${session}.png`);
  const waitScript = "new Promise((resolve) => setTimeout(resolve, 1200))";
  const textScript = [
    "(() => {",
    "const nodes = Array.from(document.querySelectorAll('[data-testid=\"tweetText\"]'));",
    "if (nodes.length) return nodes.map((n) => n.innerText).join(\"\\n\");",
    "const article = document.querySelector(\"article\");",
    "if (article) return article.innerText;",
    "return document.body?.innerText?.slice(0, 4000) || \"\";",
    "})()",
  ].join("");

  try {
    await runAgentBrowser(["--session", session, "open", url]);
    await runAgentBrowser(["--session", session, "eval", waitScript]);
    const textOutput = await runAgentBrowser([
      "--session",
      session,
      "eval",
      textScript,
      "--json",
    ]);
    const parsed = parseAgentJson(textOutput);
    const text =
      typeof parsed?.data === "string"
        ? parsed.data
        : typeof parsed?.result === "string"
          ? parsed.result
          : "";
    await runAgentBrowser([
      "--session",
      session,
      "screenshot",
      screenshotPath,
      "--full",
    ]);

    return { text, screenshotPath };
  } finally {
    try {
      await runAgentBrowser(["--session", session, "close"]);
    } catch {
      // Swallow cleanup failures.
    }
  }
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
      const postId: Id<"posts"> = await ctx.runMutation(
        internal.posts.createPostInternal,
        {
          text: cached.post.text,
          url: args.url,
          source: "x",
          authorHandle: cached.authorHandle ?? undefined,
          screenshotId: cached.post.screenshotId ?? undefined,
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
    const { text, screenshotPath } = await capturePost(args.url);
    if (!text) {
      throw new Error("No post text found from browser capture.");
    }
    const image = await readFile(screenshotPath);
    const blob = new Blob([image], { type: "image/png" });
    const screenshotId = await ctx.storage.store(blob);
    await rm(screenshotPath, { force: true });

    const postId: Id<"posts"> = await ctx.runMutation(
      internal.posts.createPostInternal,
      {
        text,
        url: args.url,
        source: "x",
        screenshotId,
        authorHandle: extractAuthorHandle(args.url) ?? undefined,
      },
    );

    return { postId, text, authorHandle: extractAuthorHandle(args.url) };
  },
});
