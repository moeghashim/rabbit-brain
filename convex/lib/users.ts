import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getAuthIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }
  return identity;
}

export async function getUserByAuthId(
  ctx: QueryCtx | MutationCtx,
  authId: string,
) {
  return ctx.db
    .query("users")
    .withIndex("byAuthId", (q) => q.eq("authId", authId))
    .unique();
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await getAuthIdentity(ctx);
  const user = await getUserByAuthId(ctx, identity.subject);
  if (!user) {
    throw new ConvexError("User not provisioned");
  }
  return { identity, user };
}

export async function getOrCreateUser(ctx: MutationCtx) {
  const identity = await getAuthIdentity(ctx);
  let user = await getUserByAuthId(ctx, identity.subject);
  if (!user) {
    const userId = await ctx.db.insert("users", {
      authId: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      plan: "free",
      createdAt: Date.now(),
    });
    user = await ctx.db.get(userId);
  }
  if (!user) {
    throw new ConvexError("User provisioning failed");
  }
  return { identity, user };
}
