import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function withUserDefaults<T extends Record<string, any> | null>(user: T) {
  if (!user) return null;

  return {
    ...user,
    timezone: user.timezone ?? "America/Bogota",
    subscription: user.subscription ?? "free",
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    badges: user.badges ?? [],
    streakFreezesAvailable: user.streakFreezesAvailable ?? 1,
    morningReminderTime: user.morningReminderTime ?? "07:00",
    eveningReminderTime: user.eveningReminderTime ?? "21:00",
  };
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return withUserDefaults(user);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = withUserDefaults(await ctx.db.get(userId));
    if (!user) return null;

    const mindMovies = await ctx.db
      .query("mindMovies")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    const streak = await ctx.db
      .query("streaks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    return {
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      subscription: user.subscription,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      totalMindMovies: mindMovies.length,
      activeMindMovies: mindMovies.filter((m) => m.status === "ready").length,
    };
  },
});

export const createOrUpdate = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    const now = Date.now();
    const existing = await ctx.db.get(userId);
    if (!existing) {
      throw new Error("Authenticated user document not found");
    }

    await ctx.db.patch(userId, {
      imageUrl: existing.imageUrl ?? existing.image,
      timezone: existing.timezone ?? "America/Bogota",
      subscription: existing.subscription ?? "free",
      xp: existing.xp ?? 0,
      level: existing.level ?? 1,
      badges: existing.badges ?? [],
      streakFreezesAvailable: existing.streakFreezesAvailable ?? 1,
      morningReminderTime: existing.morningReminderTime ?? "07:00",
      eveningReminderTime: existing.eveningReminderTime ?? "21:00",
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
    });

    return userId;
  },
});

export const updateSettings = mutation({
  args: {
    timezone: v.optional(v.string()),
    morningReminderTime: v.optional(v.string()),
    eveningReminderTime: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    const existing = await ctx.db.get(userId);
    if (!existing) {
      throw new Error("User not found");
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.timezone) updates.timezone = args.timezone;
    if (args.morningReminderTime) updates.morningReminderTime = args.morningReminderTime;
    if (args.eveningReminderTime) updates.eveningReminderTime = args.eveningReminderTime;

    await ctx.db.patch(userId, updates);
    return true;
  },
});
