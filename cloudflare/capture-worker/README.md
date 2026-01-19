# Capture Worker (Cloudflare)

This worker renders X posts using Cloudflare Browser Rendering and returns:
- extracted text
- screenshot (base64)
- author handle (derived from URL)

## Setup

```bash
cd cloudflare/capture-worker
npm install
wrangler login

# Optional but recommended
wrangler secret put CAPTURE_TOKEN

wrangler deploy
```

## Convex env vars

Set these for your Convex deployment:

```
CAPTURE_SERVICE_URL=https://<your-worker>.workers.dev
CAPTURE_SERVICE_TOKEN=<same token if set>
```

## Notes

- Requires `@cloudflare/playwright` and `nodejs_compat`.
- If screenshots fail, verify the URL is reachable without login or add an auth flow.
