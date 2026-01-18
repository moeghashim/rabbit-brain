"use client";

import { useEffect, useMemo, useState } from "react";
import { SignedOut, useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type ConceptCard = {
  id: Id<"concepts">;
  suggestionId: Id<"suggestions">;
  name: string;
  rationale: string;
  score: number;
};

export default function Home() {
  const { isSignedIn } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const createPost = useMutation(api.posts.createPost);
  const analyzePost = useAction(api.analysis.analyzePost);
  const importPost = useAction(api.x.importPost);
  const toggleFollow = useMutation(api.follows.toggleFollow);
  const submitFeedback = useMutation(api.feedback.submitFeedback);
  const createTrack = useMutation(api.tracks.createTrack);

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [postId, setPostId] = useState<Id<"posts"> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageNow] = useState(() => Date.now());
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<
    Array<Id<"suggestions">>
  >([]);
  const [creatingTrackId, setCreatingTrackId] = useState<string | null>(null);

  const postData = useQuery(
    api.posts.getPost,
    postId ? { postId } : "skip",
  );
  const myPosts = useQuery(
    api.posts.listUserPosts,
    isSignedIn ? {} : "skip",
  );
  const follows = useQuery(
    api.follows.listFollows,
    isSignedIn ? {} : "skip",
  );
  const tracks = useQuery(api.tracks.listTracks, isSignedIn ? {} : "skip");
  const author = useQuery(
    api.authors.getAuthor,
    postData?.post?.authorId ? { authorId: postData.post.authorId } : "skip",
  );
  const xUsage = useQuery(
    api.xUsage.getUsage,
    isSignedIn ? { now: usageNow } : "skip",
  );

  useEffect(() => {
    if (isSignedIn) {
      void ensureUser({});
    }
  }, [ensureUser, isSignedIn]);

  useEffect(() => {
    setDismissedSuggestionIds([]);
  }, [postId]);

  const followKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!follows) return keys;
    for (const follow of follows) {
      keys.add(`${follow.targetType}:${String(follow.targetId)}`);
    }
    return keys;
  }, [follows]);

  const dismissedSet = useMemo(() => {
    return new Set(dismissedSuggestionIds.map((id) => String(id)));
  }, [dismissedSuggestionIds]);

  const trackedConceptIds = useMemo(() => {
    const ids = new Set<string>();
    if (!tracks) return ids;
    for (const track of tracks) {
      for (const concept of track.concepts) {
        ids.add(String(concept._id));
      }
    }
    return ids;
  }, [tracks]);

  const suggestions: ConceptCard[] = useMemo(() => {
    if (!postData?.suggestions) return [];
    return postData.suggestions
      .filter(
        (entry) =>
          entry.concept && !dismissedSet.has(String(entry.suggestion._id)),
      )
      .map((entry) => ({
        id: entry.concept!._id,
        suggestionId: entry.suggestion._id,
        name: entry.concept!.name,
        rationale: entry.suggestion.rationale,
        score: entry.suggestion.score,
      }))
      .slice(0, 8);
  }, [dismissedSet, postData]);

  async function handleRejectSuggestion(suggestionId: Id<"suggestions">) {
    if (!isSignedIn) {
      setError("Sign in to reject suggestions.");
      return;
    }
    try {
      await submitFeedback({ suggestionId, vote: "down" });
      setDismissedSuggestionIds((prev) => [...prev, suggestionId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback.");
    }
  }

  async function handleCreateTrack(conceptId: Id<"concepts">) {
    if (!isSignedIn) {
      setError("Sign in to start a learning track.");
      return;
    }
    if (!postId) {
      setError("Analyze a post before starting a track.");
      return;
    }
    setCreatingTrackId(String(conceptId));
    try {
      await createTrack({
        conceptIds: [conceptId],
        postId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start track.");
    } finally {
      setCreatingTrackId(null);
    }
  }

  async function handleLearnAuthor(authorId: Id<"authors">) {
    if (!isSignedIn) {
      setError("Sign in to learn from authors.");
      return;
    }
    if (followKeys.has(`author:${String(authorId)}`)) {
      return;
    }
    try {
      await toggleFollow({ targetType: "author", targetId: authorId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to follow author.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isSignedIn) {
      setError("Sign in to analyze posts.");
      return;
    }

    const trimmedText = text.trim();
    const trimmedUrl = url.trim();

    if (!trimmedText && !trimmedUrl) {
      setError("Add an X URL (recommended) or paste the post text.");
      return;
    }

    try {
      setIsAnalyzing(true);
      if (!trimmedText && trimmedUrl) {
        const result = await importPost({ url: trimmedUrl });
        setText(result.text);
        setPostId(result.postId);
        await analyzePost({ postId: result.postId });
        return;
      }

      const id = await createPost({
        text: trimmedText,
        url: trimmedUrl ? trimmedUrl : undefined,
      });
      setPostId(id);
      await analyzePost({ postId: id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,239,110,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-40 left-[-120px] h-[360px] w-[360px] rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-12 right-[-160px] h-[420px] w-[420px] rounded-full bg-lime-400/20 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:120px_120px]" />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-10">
          <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 animate-fade-up">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                Fast concept mapping. Zero fuss.
              </p>
              <h1 className="font-serif text-5xl leading-[0.95] text-neutral-100 md:text-7xl">
                rabbitbrain<span className="text-emerald-300">.fast</span>
              </h1>
              <p className="max-w-xl text-lg text-neutral-300">
                Paste any X post. We map it to learning concepts and let you
                follow the ideas or the author for a tailored feed.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#analyze"
                  className="rounded-full bg-emerald-300 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-[0_0_30px_rgba(164,239,110,0.35)] transition hover:bg-emerald-200"
                >
                  Analyze post
                </a>
                <a
                  href="/feed"
                  className="rounded-full border border-emerald-300/40 px-5 py-2 text-sm text-emerald-100/90 transition hover:border-emerald-200"
                >
                  View feed
                </a>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-emerald-100/70">
                <span className="rounded-full border border-emerald-400/20 px-3 py-1">
                  Concept extraction
                </span>
                <span className="rounded-full border border-emerald-400/20 px-3 py-1">
                  Follow authors
                </span>
                <span className="rounded-full border border-emerald-400/20 px-3 py-1">
                  Weekly digests
                </span>
              </div>
            </div>

            <div className="animate-fade-up-delay">
              <div className="rounded-3xl border border-emerald-900/40 bg-neutral-950/70 p-6 shadow-[0_0_60px_rgba(16,185,129,0.16)] backdrop-blur">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <div className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                    <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  </div>
                  <span className="uppercase tracking-[0.3em] text-emerald-200/60">
                    Paste & run
                  </span>
                </div>
                <form
                  id="analyze"
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.4em] text-emerald-200/60">
                      X post URL (recommended)
                    </label>
                    <input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-emerald-900/40 bg-black/40 p-4 text-base text-neutral-100 outline-none transition focus:border-emerald-300/60"
                      placeholder="https://x.com/user/status/..."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.4em] text-emerald-200/60">
                      Post text (optional)
                    </label>
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={6}
                      className="mt-3 w-full rounded-2xl border border-emerald-900/40 bg-black/40 p-4 text-sm text-neutral-100 outline-none transition focus:border-emerald-300/60"
                      placeholder="Optional: paste the post text here..."
                    />
                  </div>
                  {error ? (
                    <p className="text-sm text-rose-300">{error}</p>
                  ) : null}
                  <SignedOut>
                    <div className="rounded-2xl border border-emerald-900/40 bg-black/30 px-4 py-3 text-xs text-emerald-100/70">
                      Sign in to analyze posts.
                    </div>
                  </SignedOut>
                  <button
                    type="submit"
                    disabled={!isSignedIn || isAnalyzing}
                    className="w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze post"}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 animate-fade-up-delay-2">
              <div>
                <h2 className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                  Suggestions
                </h2>
                <p className="mt-3 text-sm text-neutral-400">
                  Concept clusters we pulled from your last analysis.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {suggestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-900/40 bg-neutral-950/50 p-6 text-sm text-neutral-500">
                    Submit a post to see concept matches.
                  </div>
                ) : (
                  suggestions.map((concept) => {
                    const isFollowing = followKeys.has(
                      `concept:${String(concept.id)}`,
                    );
                    return (
                      <div
                        key={concept.id}
                        className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-neutral-100">
                              {concept.name}
                            </p>
                            <p className="mt-2 text-sm text-neutral-400">
                              {concept.rationale}
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200/80">
                            {Math.round(concept.score * 100)}%
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            toggleFollow({
                              targetType: "concept",
                              targetId: concept.id,
                            })
                          }
                          className="mt-4 w-full rounded-full border border-emerald-500/40 px-3 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/80 transition hover:border-emerald-300"
                        >
                          {isFollowing ? "Unfollow" : "Follow concept"}
                        </button>
                        <button
                          onClick={() =>
                            handleRejectSuggestion(concept.suggestionId)
                          }
                          className="mt-3 w-full rounded-full border border-rose-500/30 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-rose-200/70 transition hover:border-rose-400/60"
                        >
                          Not relevant
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                      Learning tracks
                    </h3>
                    <p className="mt-2 text-sm text-neutral-400">
                      Start a Feynman-style track from any concept you want to
                      master.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {suggestions.map((concept) => {
                      const isTracked = trackedConceptIds.has(
                        String(concept.id),
                      );
                      const isCreating =
                        creatingTrackId === String(concept.id);
                      return (
                        <div
                          key={`track-${concept.id}`}
                          className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-5"
                        >
                          <p className="text-lg font-semibold text-neutral-100">
                            Learn {concept.name}
                          </p>
                          <p className="mt-2 text-sm text-neutral-400">
                            {concept.rationale}
                          </p>
                          <button
                            onClick={() => handleCreateTrack(concept.id)}
                            disabled={isTracked || isCreating}
                            className="mt-4 w-full rounded-full border border-emerald-500/40 px-3 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/80 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isTracked
                              ? "Track active"
                              : isCreating
                                ? "Starting..."
                                : "Start track"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {author ? (
                <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-200/60">
                        Author
                      </p>
                        <p className="mt-2 text-lg font-semibold text-neutral-100">
                          @{author.handle}
                        </p>
                      </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleLearnAuthor(author._id)}
                        disabled={followKeys.has(`author:${String(author._id)}`)}
                        className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/80 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {followKeys.has(`author:${String(author._id)}`)
                          ? "Learning enabled"
                          : "Learn from author"}
                      </button>
                      {followKeys.has(`author:${String(author._id)}`) ? (
                        <button
                          onClick={() =>
                            toggleFollow({
                              targetType: "author",
                              targetId: author._id,
                            })
                          }
                          className="rounded-full border border-rose-500/30 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-rose-200/70 transition hover:border-rose-400/60"
                        >
                          Unfollow
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6">
                <h2 className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                  Your feed
                </h2>
                <p className="mt-3 text-sm text-neutral-400">
                  Follow concepts or authors to shape what you see. Your feed
                  populates once you follow something.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6">
                <h2 className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                  X API usage
                </h2>
                <p className="mt-3 text-sm text-neutral-400">
                  We cache analyses by URL to reduce calls. Paste text if you
                  hit the limit.
                </p>
                <div className="mt-4 text-sm text-neutral-300">
                  {!xUsage ? (
                    <p className="text-neutral-500">Sign in to view usage.</p>
                  ) : (
                    <>
                      <p>
                        {xUsage.total} / {xUsage.limit} requests in the last{" "}
                        {xUsage.windowMinutes} minutes
                      </p>
                      <p className="mt-2 text-xs text-neutral-500">
                        Rate limited: {xUsage.rateLimited}
                      </p>
                      {xUsage.lastResetAt ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Last reset:{" "}
                          {new Date(
                            xUsage.lastResetAt,
                          ).toLocaleTimeString()}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6">
                <h2 className="text-xs uppercase tracking-[0.4em] text-emerald-200/60">
                  Recent posts
                </h2>
                <div className="mt-4 space-y-3 text-sm text-neutral-300">
                  {!myPosts ? (
                    <p className="text-neutral-500">
                      Sign in to see your history.
                    </p>
                  ) : myPosts.length === 0 ? (
                    <p className="text-neutral-500">No posts yet.</p>
                  ) : (
                    myPosts.map((post) => (
                      <button
                        key={post._id}
                        onClick={() => setPostId(post._id)}
                        className="w-full rounded-2xl border border-emerald-900/40 bg-black/40 px-4 py-3 text-left text-xs text-neutral-400 transition hover:border-emerald-500/40"
                      >
                        <p className="line-clamp-2 text-sm text-neutral-200">
                          {post.text}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-neutral-500">
                          {post.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </section>
      </main>
    </div>
  );
}
