import { chromium } from "@cloudflare/playwright";
import { Buffer } from "node:buffer";

const TEXT_LIMIT = 4000;

function extractAuthorHandle(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const statusIndex = parts.indexOf("status");
    if (statusIndex > 0) {
      return parts[statusIndex - 1] ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (env.CAPTURE_TOKEN) {
      const auth = request.headers.get("authorization") || "";
      if (auth !== `Bearer ${env.CAPTURE_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    let payload: { url?: string; screenshotOnly?: boolean } | undefined;
    try {
      payload = (await request.json()) as {
        url?: string;
        screenshotOnly?: boolean;
      };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const url = payload?.url;
    if (!url) {
      return new Response("Missing url", { status: 400 });
    }

    const screenshotOnly = Boolean(payload?.screenshotOnly);
    const browser = await chromium.launch(env.BROWSER);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);

      let text = "";
      if (!screenshotOnly) {
        text = await page.evaluate((limit) => {
          const nodes = Array.from(
            document.querySelectorAll('[data-testid="tweetText"]'),
          );
          if (nodes.length) {
            return nodes.map((node) => node.innerText).join("\n");
          }
          const article = document.querySelector("article");
          if (article) return article.innerText;
          return document.body?.innerText?.slice(0, limit) || "";
        }, TEXT_LIMIT);
      }

      const target =
        (await page.$('[data-testid="tweet"]')) ||
        (await page.$("article"));
      const screenshot = target
        ? await target.screenshot({ type: "png" })
        : await page.screenshot({ type: "png", fullPage: true });
      const screenshotBase64 = Buffer.from(screenshot).toString("base64");

      return Response.json({
        text,
        screenshotBase64,
        authorHandle: extractAuthorHandle(url),
      });
    } finally {
      try {
        await page.close();
      } catch {
        // ignore
      }
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  },
};

interface Env {
  BROWSER: Fetcher;
  CAPTURE_TOKEN?: string;
}
