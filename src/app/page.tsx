"use client";

import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type ConceptCard = {
  id: Id<"concepts">;
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

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [postId, setPostId] = useState<Id<"posts"> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const author = useQuery(
    api.authors.getAuthor,
    postData?.post?.authorId ? { authorId: postData.post.authorId } : "skip",
  );

  useEffect(() => {
    if (isSignedIn) {
      void ensureUser({});
    }
  }, [ensureUser, isSignedIn]);

  const followKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!follows) return keys;
    for (const follow of follows) {
      keys.add(`${follow.targetType}:${String(follow.targetId)}`);
    }
    return keys;
  }, [follows]);

  const suggestions: ConceptCard[] = useMemo(() => {
    if (!postData?.suggestions) return [];
    return postData.suggestions
      .filter((entry) => entry.concept)
      .map((entry) => ({
        id: entry.concept!._id,
        name: entry.concept!.name,
        rationale: entry.suggestion.rationale,
        score: entry.suggestion.score,
      }))
      .slice(0, 8);
  }, [postData]);

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
      setError("Paste a post or an X URL to analyze.");
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500" />
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
                Rabbitbrain
              </p>
              <p className="text-lg font-semibold">Concept radar for X</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/feed"
              className="text-sm text-neutral-400 transition hover:text-neutral-200"
            >
              Feed
            </a>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div>
            <h1 className="text-4xl font-semibold leading-tight">
              Turn a post into a learning track.
            </h1>
            <p className="mt-3 text-neutral-400">
              Paste any X post. We map it to learning concepts and let you
              follow the ideas or the author for a tailored feed.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6"
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  X post
                </label>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={6}
                  className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  placeholder="Paste the post text here..."
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Post URL (optional)
                </label>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  placeholder="https://x.com/user/status/..."
                />
              </div>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-rose-400">{error}</p>
            ) : null}
            <SignedOut>
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-neutral-400">
                Sign in to analyze posts.
              </div>
            </SignedOut>
            <button
              type="submit"
              disabled={!isSignedIn || isAnalyzing}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze post"}
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
              Suggestions
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
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
                      className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">
                            {concept.name}
                          </p>
                          <p className="mt-2 text-sm text-neutral-400">
                            {concept.rationale}
                          </p>
                        </div>
                        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
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
                        className="mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500"
                      >
                        {isFollowing ? "Unfollow" : "Follow concept"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {author ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                    Author
                  </p>
                  <p className="mt-2 text-lg font-semibold">@{author.handle}</p>
                </div>
                <button
                  onClick={() =>
                    toggleFollow({
                      targetType: "author",
                      targetId: author._id,
                    })
                  }
                  className="rounded-full border border-neutral-700 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300 transition hover:border-neutral-500"
                >
                  {followKeys.has(`author:${String(author._id)}`)
                    ? "Unfollow"
                    : "Follow author"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
              Your feed
            </h2>
            <p className="mt-3 text-sm text-neutral-400">
              Follow concepts or authors to shape what you see. Your feed will
              populate once you follow something.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
            <h2 className="text-sm uppercase tracking-[0.2em] text-neutral-500">
              Recent posts
            </h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              {!myPosts ? (
                <p className="text-neutral-500">Sign in to see your history.</p>
              ) : myPosts.length === 0 ? (
                <p className="text-neutral-500">No posts yet.</p>
              ) : (
                myPosts.map((post) => (
                  <button
                    key={post._id}
                    onClick={() => setPostId(post._id)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-left text-xs text-neutral-400 transition hover:border-neutral-600"
                  >
                    <p className="line-clamp-2 text-sm text-neutral-200">
                      {post.text}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                      {post.status}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
