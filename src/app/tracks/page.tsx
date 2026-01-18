"use client";

import { SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function TracksPage() {
  const { isSignedIn } = useUser();
  const tracks = useQuery(api.tracks.listTracks, isSignedIn ? {} : "skip");

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-serif text-3xl text-neutral-100">Learning tracks</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Tracks help you focus on concepts using a Feynman-style learning loop.
      </p>

      <div className="mt-8 space-y-4">
        <SignedOut>
          <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6 text-sm text-neutral-500">
            <SignInButton mode="modal">
              <button className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/90 transition hover:border-emerald-300/70">
                Sign in to view your tracks
              </button>
            </SignInButton>
          </div>
        </SignedOut>
        {isSignedIn && !tracks ? (
          <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6 text-sm text-neutral-500">
            Loading tracks...
          </div>
        ) : isSignedIn && tracks && tracks.length === 0 ? (
          <div className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6 text-sm text-neutral-500">
            Start a track from an analysis to see it here.
          </div>
        ) : isSignedIn && tracks ? (
          tracks.map((entry) => (
            <div
              key={entry.track._id}
              className="rounded-2xl border border-emerald-900/40 bg-neutral-950/60 p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-200/60">
                    Track
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-100">
                    {entry.track.title}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200/70">
                  {entry.concepts.length} concept
                  {entry.concepts.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.concepts.map((concept) => (
                  <span
                    key={concept._id}
                    className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200/80"
                  >
                    {concept.name}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : null}
      </div>
    </div>
  );
}
