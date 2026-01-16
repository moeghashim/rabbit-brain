"use client";

import { SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function FeedPage() {
  const { isSignedIn } = useUser();
  const feed = useQuery(api.posts.listFeed, isSignedIn ? {} : "skip");
  const feedItems = feed ?? [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Followed feed</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Posts connected to the concepts and authors you follow.
        </p>

        <div className="mt-8 space-y-4">
          <SignedOut>
            <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-500">
              <SignInButton mode="modal">
                <button className="rounded-full border border-neutral-700 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-300">
                  Sign in to view your feed
                </button>
              </SignInButton>
            </div>
          </SignedOut>
          {isSignedIn && !feed ? (
            <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-500">
              Loading feed...
            </div>
          ) : isSignedIn && feedItems.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-500">
              Follow a concept or author to populate this feed.
            </div>
          ) : isSignedIn && feed ? (
            feedItems.map((item) => (
              <div
                key={item.post._id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6"
              >
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {item.authorHandle ? `@${item.authorHandle}` : "X post"}
                  </span>
                  {item.post.url ? (
                    <a
                      href={item.post.url}
                      className="text-neutral-400 transition hover:text-neutral-200"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on X
                    </a>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-neutral-200">{item.post.text}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.matchedAuthor ? (
                    <span className="rounded-full border border-amber-500/50 px-3 py-1 text-xs text-amber-300">
                      Followed author
                    </span>
                  ) : null}
                  {item.suggestions.map((suggestion) => (
                    <span
                      key={suggestion.conceptId}
                      className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400"
                    >
                      {suggestion.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : null}
        </div>
      </div>
    </div>
  );
}
