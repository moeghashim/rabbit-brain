import { mutation, query } from "./_generated/server";
import { getOrCreateUser, requireUser } from "./lib/users";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    return user;
  },
});

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await getOrCreateUser(ctx);
    return user;
  },
});
