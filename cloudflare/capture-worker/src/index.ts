import { launch } from "@cloudflare/playwright";
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

function parseCookieHeader(header: string | undefined) {
  if (!header) return [];
  const parts = header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const pairs = parts
    .map((part) => {
      const [name, ...rest] = part.split("=");
      const value = rest.join("=");
      return name && value ? { name, value } : null;
    })
    .filter(
      (pair): pair is { name: string; value: string } => pair !== null,
    );

  const domains = [".x.com", ".twitter.com"];
  const cookies = [];
  for (const domain of domains) {
    for (const pair of pairs) {
      cookies.push({
        name: pair.name,
        value: pair.value,
        domain,
        path: "/",
      });
    }
  }
  return cookies;
}

function isLoginWall(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("don’t miss what’s happening") ||
    normalized.includes("don't miss what's happening") ||
    normalized.includes("log in") ||
    normalized.includes("sign up")
  );
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
    const browser = await launch(env.BROWSER);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const cookies = parseCookieHeader(env.X_COOKIE);
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }
    const page = await context.newPage();

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
      const requiresAuth = !screenshotOnly && isLoginWall(text);

      return Response.json({
        text: requiresAuth ? "" : text,
        screenshotBase64,
        authorHandle: extractAuthorHandle(url),
        requiresAuth,
      });
    } finally {
      try {
        await page.close();
      } catch {
        // ignore
      }
      try {
        await context.close();
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
  X_COOKIE?: string;
}
