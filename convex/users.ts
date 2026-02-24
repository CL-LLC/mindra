import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Get current user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
  },
});

// Create or update user from Clerk
export const createOrUpdate = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing user
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new user with default values
    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      timezone: 'America/Bogota',
      subscription: 'free',
      xp: 0,
      level: 1,
      badges: [],
      streakFreezesAvailable: 1,
      morningReminderTime: '07:00',
      eveningReminderTime: '21:00',
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update user subscription
export const updateSubscription = mutation({
  args: {
    clerkId: v.string(),
    subscription: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('ultra')
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(user._id, {
      subscription: args.subscription,
      updatedAt: Date.now(),
    });
  },
});

// Add XP to user
export const addXP = mutation({
  args: {
    clerkId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    const newXP = user.xp + args.amount;
    const newLevel = Math.floor(newXP / 500) + 1; // 500 XP per level

    await ctx.db.patch(user._id, {
      xp: newXP,
      level: newLevel,
      updatedAt: Date.now(),
    });

    return { xp: newXP, level: newLevel, leveledUp: newLevel > user.level };
  },
});

// Add badge to user
export const addBadge = mutation({
  args: {
    clerkId: v.string(),
    badgeId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    if (user.badges.includes(args.badgeId)) {
      return false; // Already has this badge
    }

    await ctx.db.patch(user._id, {
      badges: [...user.badges, args.badgeId],
      updatedAt: Date.now(),
    });

    // Also record in achievements
    await ctx.db.insert('achievements', {
      userId: user._id,
      badgeId: args.badgeId,
      earnedAt: Date.now(),
      xpAwarded: 50, // Default XP for badges
    });

    return true;
  },
});

// Get user stats
export const getStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    // Get streak info
    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first();

    // Get mind movies count
    const mindMovies = await ctx.db
      .query('mindMovies')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect();

    return {
      xp: user.xp,
      level: user.level,
      badges: user.badges,
      subscription: user.subscription,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      totalMindMovies: mindMovies.length,
      activeMindMovies: mindMovies.filter((m) => m.status === 'ready').length,
    };
  },
});
