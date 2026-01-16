# Rabbitbrain

Analyze X posts, extract learning concepts, and follow ideas or authors to shape a personal feed.

## Stack
- Next.js App Router
- Convex (backend + database)
- Clerk (auth)

## Setup
1. Copy `.env.local.example` to `.env.local` and fill in the values.
2. Start Convex (generates `convex/_generated`):
   ```bash
   npm run convex
   ```
3. Start the web app:
   ```bash
   npm run dev
   ```

## Notes
- `NEXT_PUBLIC_CONVEX_URL` comes from the Convex dashboard.
- `CLERK_ISSUER_URL` and `CLERK_APPLICATION_ID` should match your Clerk JWT template.
- `OPENAI_API_KEY` is optional; if unset, analysis falls back to a local heuristic.
- `X_API_BEARER_TOKEN` is optional; set it to enable importing post text from X URLs.
- The feed and digests are wired for Convex cron jobs; connect Resend when ready.
