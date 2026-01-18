import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOrCreateUser, requireUser } from "./lib/users";

function buildTrackTitle(conceptNames: string[]) {
  if (conceptNames.length === 0) return "Learning track";
  if (conceptNames.length === 1) return `Learn ${conceptNames[0]}`;
  const visible = conceptNames.slice(0, 3);
  const remaining = conceptNames.length - visible.length;
  return `Learn ${visible.join(" + ")}${
    remaining > 0 ? ` + ${remaining} more` : ""
  }`;
}

export const createTrack = mutation({
  args: {
    conceptIds: v.array(v.id("concepts")),
    postId: v.optional(v.id("posts")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getOrCreateUser(ctx);
    if (args.conceptIds.length === 0) {
      throw new Error("Select at least one concept.");
    }

    const uniqueConceptIds = Array.from(new Set(args.conceptIds));
    const concepts = await Promise.all(
      uniqueConceptIds.map((conceptId) => ctx.db.get(conceptId)),
    );
    const conceptNames = concepts
      .map((concept) => concept?.name)
      .filter((name): name is string => Boolean(name));

    const trackId = await ctx.db.insert("tracks", {
      userId: user._id,
      title: args.title ?? buildTrackTitle(conceptNames),
      sourcePostId: args.postId,
      createdAt: Date.now(),
    });

    for (const conceptId of uniqueConceptIds) {
      await ctx.db.insert("trackConcepts", {
        trackId,
        conceptId,
        createdAt: Date.now(),
      });
    }

    return { trackId };
  },
});

export const listTracks = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

    const results = [] as Array<{
      track: typeof tracks[number];
      concepts: Array<{ _id: Id<"concepts">; name: string }>;
    }>;

    for (const track of tracks) {
      const trackConcepts = await ctx.db
        .query("trackConcepts")
        .withIndex("byTrack", (q) => q.eq("trackId", track._id))
        .collect();
      const concepts = await Promise.all(
        trackConcepts.map(async (link) => {
          const concept = await ctx.db.get(link.conceptId);
          if (!concept) return null;
          return { _id: concept._id, name: concept.name };
        }),
      );

      const cleaned = concepts.filter(
        (concept): concept is { _id: Id<"concepts">; name: string } =>
          concept !== null,
      );

      results.push({
        track,
        concepts: cleaned,
      });
    }

    return results;
  },
});
