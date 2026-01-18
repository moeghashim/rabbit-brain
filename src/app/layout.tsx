import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Providers from "./providers";
import SiteHeader from "./site-header";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rabbitbrain",
  description:
    "Analyze X posts, extract learning concepts, and follow ideas or authors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <ClerkProvider>
          <Providers>
            <div className="flex min-h-screen flex-col bg-[#050807] text-neutral-100">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <footer className="border-t border-emerald-900/30 bg-[#050807]">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-xs text-emerald-100/60 md:flex-row md:items-center md:justify-between">
                  <p className="text-[11px] uppercase tracking-[0.4em]">
                    Rabbitbrain
                  </p>
                  <p className="text-neutral-500">
                    Concept radar for X. Built for learning trails.
                  </p>
                  <div className="flex gap-4 text-[11px] uppercase tracking-[0.3em] text-emerald-100/70">
                    <Link href="/#analyze" className="hover:text-emerald-200">
                      Analyze
                    </Link>
                    <Link href="/feed" className="hover:text-emerald-200">
                      Feed
                    </Link>
                  </div>
                </div>
              </footer>
            </div>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
