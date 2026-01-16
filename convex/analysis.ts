"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "your",
  "into",
  "about",
  "just",
  "when",
  "what",
  "which",
  "have",
  "will",
  "been",
  "were",
  "are",
  "was",
  "you",
  "our",
  "not",
  "but",
  "can",
  "has",
  "its",
  "out",
  "why",
  "how",
  "via",
]);

type ConceptSuggestion = {
  name: string;
  rationale: string;
  score: number;
  description?: string;
};

type AnalysisResult = {
  concepts: ConceptSuggestion[];
  authorHandle?: string | null;
};

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractAuthorHandle(text: string) {
  const match = text.match(/@([a-zA-Z0-9_]{1,15})/);
  return match ? match[1] : null;
}

function naiveExtract(text: string): AnalysisResult {
  const words = (text.toLowerCase().match(/[a-z0-9+\-]{3,}/g) || [])
    .filter((word) => !STOPWORDS.has(word))
    .slice(0, 40);
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const concepts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word, count]) => ({
      name: toTitleCase(word.replace(/\+/g, " + ")),
      rationale: `Mentioned ${count}x in the post`,
      score: Math.min(0.9, 0.4 + count * 0.1),
    }));

  return {
    concepts,
    authorHandle: extractAuthorHandle(text),
  };
}

async function llmExtract(text: string): Promise<AnalysisResult> {
  if (!OPENAI_API_KEY) {
    return naiveExtract(text);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You extract learning concepts from short posts. Respond with strict JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Extract 5-8 learning concepts, each with name, rationale, score (0-1), and optional description. Optionally include authorHandle if present.",
            text,
          }),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return naiveExtract(text);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return naiveExtract(text);
  }

  try {
    const parsed = JSON.parse(content) as AnalysisResult;
    if (!parsed?.concepts?.length) {
      return naiveExtract(text);
    }
    return parsed;
  } catch {
    return naiveExtract(text);
  }
}

export const analyzePost = action({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.runQuery(internal.posts.getPostForAnalysis, {
      postId: args.postId,
    });
    if (!post) {
      return { status: "missing" };
    }

    try {
      const analysis = await llmExtract(post.text);
      const conceptsPayload = analysis.concepts.map((concept) => ({
        name: concept.name,
        description: concept.description,
        aliases: [],
        status: "active" as const,
      }));
      const conceptIds = await ctx.runMutation(
        internal.concepts.upsertConcepts,
        { concepts: conceptsPayload },
      );

      let authorId: Id<"authors"> | undefined;
      const authorHandle = analysis.authorHandle ?? post.authorHandle;
      if (authorHandle) {
        authorId = await ctx.runMutation(internal.authors.upsertAuthor, {
          handle: authorHandle,
        });
      }

      await ctx.runMutation(internal.posts.applyAnalysis, {
        postId: args.postId,
        authorId,
        suggestions: analysis.concepts.map((concept, index) => ({
          conceptId: conceptIds[index],
          score: concept.score,
          rationale: concept.rationale,
        })),
      });

      return { status: "ok" };
    } catch (error) {
      await ctx.runMutation(internal.posts.markFailed, {
        postId: args.postId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      return { status: "failed" };
    }
  },
});
