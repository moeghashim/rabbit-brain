import { AuthConfig } from "convex/server";

const domain =
  process.env.CLERK_ISSUER_URL ?? process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!domain) {
  throw new Error(
    "Missing Clerk issuer URL. Set CLERK_ISSUER_URL or CLERK_JWT_ISSUER_DOMAIN.",
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: process.env.CLERK_APPLICATION_ID ?? "convex",
    },
  ],
} satisfies AuthConfig;
