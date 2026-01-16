"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[radial-gradient(circle_at_top,_rgba(164,239,110,0.14),_rgba(5,8,7,0.95)_70%)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <a href="/" className="flex items-center gap-3">
          <img src="/icon.svg" alt="Rabbitbrain logo" className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-200/70">
              rabbitbrain
            </p>
            <p className="text-sm text-neutral-300">Concept radar for X</p>
          </div>
        </a>
        <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-emerald-100/70">
          <a href="/#analyze" className="transition hover:text-emerald-200">
            Analyze
          </a>
          <a href="/feed" className="transition hover:text-emerald-200">
            Feed
          </a>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full border border-emerald-500/40 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-emerald-200/90 transition hover:border-emerald-300/70">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
