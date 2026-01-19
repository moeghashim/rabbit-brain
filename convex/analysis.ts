"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || "grok-4-fast";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

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
  "also",
  "some",
  "like",
  "very",
  "really",
  "more",
  "most",
  "many",
  "much",
  "even",
  "then",
  "than",
  "there",
  "here",
  "they",
  "them",
  "their",
  "these",
  "those",
  "its",
  "it's",
  "our",
  "we",
  "us",
  "you",
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
  category?: string;
};

type AnalysisResult = {
  concepts: ConceptSuggestion[];
  authorHandle?: string | null;
};

const CONCEPT_ONTOLOGY = [
  "Agents & autonomy",
  "Prompting & evaluation",
  "Tooling & orchestration",
  "Data & retrieval (RAG)",
  "Model behavior & alignment",
  "Software architecture",
  "Developer workflow",
  "Infrastructure & scaling",
  "Security & privacy",
  "Product & UX",
  "Business & strategy",
];

const BANNED_TOKENS = new Set([
  "yup",
  "yeah",
  "ok",
  "okay",
  "lol",
  "lmao",
  "nice",
  "cool",
  "myself",
  "me",
  "i",
  "we",
  "you",
  "they",
  "buit",
  "tho",
  "tbh",
  "ngl",
]);

const ALLOWED_SINGLE_WORDS = new Set([
  "ai",
  "ml",
  "llm",
  "llms",
  "rag",
  "oauth",
  "tls",
  "http",
  "https",
  "rust",
  "python",
  "golang",
  "go",
  "java",
  "javascript",
  "typescript",
  "react",
  "docker",
  "kubernetes",
  "postgres",
  "redis",
  "graphql",
  "devops",
]);

const WEAK_SINGLE_WORDS = new Set([
  "yup",
  "yeah",
  "yes",
  "no",
  "maybe",
  "trying",
  "made",
  "make",
  "built",
  "build",
  "myself",
  "self",
  "important",
  "tips",
  "way",
  "stuff",
  "things",
  "people",
  "someone",
  "someone",
  "anyone",
  "everyone",
]);

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

function normalizeConceptName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isBadConceptName(value: string) {
  if (!value) return true;
  const normalized = normalizeConceptName(value);
  if (!normalized) return true;
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => STOPWORDS.has(token));
}

function isWeakSingleWord(value: string) {
  const normalized = normalizeConceptName(value);
  if (!normalized) return true;
  if (normalized.includes(" ")) return false;
  if (STOPWORDS.has(normalized) || WEAK_SINGLE_WORDS.has(normalized)) {
    return true;
  }
  if (ALLOWED_SINGLE_WORDS.has(normalized)) {
    return false;
  }
  return normalized.length < 4;
}

function containsBannedToken(value: string) {
  const tokens = normalizeConceptName(value).split(" ").filter(Boolean);
  return tokens.some((token) => BANNED_TOKENS.has(token));
}

function sanitizeConcepts(
  concepts: ConceptSuggestion[],
  options?: { avoidConcepts?: string[] },
) {
  const seen = new Set<string>();
  const avoid = new Set(
    (options?.avoidConcepts ?? [])
      .map((value) => normalizeConceptName(value))
      .filter(Boolean),
  );
  return concepts.filter((concept) => {
    if (isBadConceptName(concept.name)) {
      return false;
    }
    if (containsBannedToken(concept.name)) {
      return false;
    }
    const normalized = normalizeConceptName(concept.name);
    if (!normalized || seen.has(normalized) || avoid.has(normalized)) {
      return false;
    }
    if (isWeakSingleWord(concept.name)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function naiveExtract(
  text: string,
  options?: { avoidConcepts?: string[] },
): AnalysisResult {
  const words = (text.toLowerCase().match(/[a-z0-9+\-]{3,}/g) || [])
    .filter((word) => !STOPWORDS.has(word))
    .slice(0, 40);
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const concepts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({
      name: toTitleCase(word.replace(/\+/g, " + ")),
      rationale: `Mentioned ${count}x in the post`,
      score: Math.min(0.9, 0.4 + count * 0.1),
    }));

  return {
    concepts: sanitizeConcepts(concepts, options),
    authorHandle: extractAuthorHandle(text),
  };
}

type LlmProvider = "xai" | "openai" | "none";

function getProvider(): LlmProvider {
  if (XAI_API_KEY) return "xai";
  if (OPENAI_API_KEY) return "openai";
  return "none";
}

async function llmExtract(
  text: string,
  options?: { avoidConcepts?: string[] },
): Promise<AnalysisResult> {
  const provider = getProvider();
  if (provider === "none") return naiveExtract(text, options);

  const schema = {
    name: "concept_extraction",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        concepts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              rationale: { type: "string" },
              score: { type: "number" },
              description: { type: "string" },
              category: { type: "string" },
            },
            required: ["name", "rationale", "score", "category"],
          },
        },
        authorHandle: { type: ["string", "null"] },
      },
      required: ["concepts"],
    },
  };

  const responseFormat = {
    type: "json_schema",
    json_schema:
      provider === "xai"
        ? schema
        : {
            ...schema,
            schema: {
            ...schema.schema,
            properties: {
              ...schema.schema.properties,
              concepts: {
                ...schema.schema.properties.concepts,
                minItems: 1,
                maxItems: 3,
              },
            },
          },
        },
  };

  const endpoint =
    provider === "xai"
      ? "https://api.x.ai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const apiKey = provider === "xai" ? XAI_API_KEY : OPENAI_API_KEY;
  const model = provider === "xai" ? XAI_MODEL : OPENAI_MODEL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
            task: "Extract 1-3 high-signal learning concepts from the post. A valid concept is (a) a 2-4 word noun phrase OR (b) a canonical technical term/proper noun, and (c) commonly discussed by others (i.e., would plausibly appear in docs/blog titles). Reject slang, filler, pronouns, acknowledgements, typos, and generic verbs/adjectives. Prefer concepts that are central to the post’s point. Return an array of concepts with: name, rationale (1 sentence), score (0-1), category (must be one of ontology), and optional description (<= 160 chars).",
            text,
            maxConcepts: 3,
            minConcepts: 1,
            conceptNameStyle: "Title Case; 2-4 words preferred",
            bannedTokens: Array.from(BANNED_TOKENS),
            ontology: CONCEPT_ONTOLOGY,
            avoidConcepts: options?.avoidConcepts ?? [],
          }),
        },
      ],
      response_format: responseFormat,
    }),
  });

  if (!response.ok) {
    return naiveExtract(text, options);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    return naiveExtract(text, options);
  }

  try {
    const parsed = JSON.parse(content) as AnalysisResult;
    if (!parsed?.concepts?.length) {
      return naiveExtract(text, options);
    }
    const cleaned = sanitizeConcepts(parsed.concepts, options);
    const limited = cleaned.slice(0, 3);
    if (limited.length === 0) {
      return naiveExtract(text, options);
    }
    return { ...parsed, concepts: limited };
  } catch {
    return naiveExtract(text, options);
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
      const avoidConcepts = await ctx.runQuery(
        internal.feedback.listDownvotedConceptNames,
        { userId: post.userId, limit: 40 },
      );
      const analysis = await llmExtract(post.text, {
        avoidConcepts,
      });
      const conceptsPayload = analysis.concepts.map((concept) => ({
        name: concept.name,
        description:
          concept.description ??
          (concept.category ? `Category: ${concept.category}` : undefined),
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
