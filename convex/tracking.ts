import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

// ============================================
// HELPER: Get authenticated user or throw
// ============================================
async function getAuthenticatedUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error('Unauthorized: Please sign in');
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error('User not found in database');
  }

  return user;
}

// ============================================
// PUBLIC QUERIES
// ============================================

// Get today's tracking for a mind movie
export const getToday = query({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const today = new Date().toISOString().split('T')[0];

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      return null;
    }

    return await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).eq('date', today)
      )
      .filter((q) => q.eq(q.field('mindMovieId'), args.mindMovieId))
      .first();
  },
});

// Get tracking history (bounded to 30 days)
export const getHistory = query({
  args: {
    mindMovieId: v.id('mindMovies'),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const days = Math.min(args.days ?? 7, 30); // Max 30 days

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const all = await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).gte('date', startDateStr)
      )
      .take(days * 2); // Bounded

    // Filter in code (more readable)
    return all.filter((t) => t.mindMovieId === args.mindMovieId);
  },
});

// Get weekly stats
export const getWeeklyStats = query({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.object({
    totalSessions: v.number(),
    perfectDays: v.number(),
    morningOnly: v.number(),
    eveningOnly: v.number(),
    missedDays: v.number(),
    totalXP: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      return {
        totalSessions: 0,
        perfectDays: 0,
        morningOnly: 0,
        eveningOnly: 0,
        missedDays: 0,
        totalXP: 0,
      };
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDateStr = weekAgo.toISOString().split('T')[0];

    const tracking = await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).gte('date', startDateStr)
      )
      .take(14); // Max 7 days * 2 sessions

    // Filter in code
    const filtered = tracking.filter((t) => t.mindMovieId === args.mindMovieId);

    return {
      totalSessions: filtered.reduce(
        (acc, t) => acc + (t.morningCompleted ? 1 : 0) + (t.eveningCompleted ? 1 : 0),
        0
      ),
      perfectDays: filtered.filter((t) => t.morningCompleted && t.eveningCompleted).length,
      morningOnly: filtered.filter((t) => t.morningCompleted && !t.eveningCompleted).length,
      eveningOnly: filtered.filter((t) => !t.morningCompleted && t.eveningCompleted).length,
      missedDays: filtered.filter((t) => !t.morningCompleted && !t.eveningCompleted).length,
      totalXP: filtered.reduce((acc, t) => acc + (t.xpEarned || 0), 0),
    };
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

// Record morning session
export const recordMorning = mutation({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.object({
    trackingId: v.id('usageTracking'),
    xpEarned: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const today = new Date().toISOString().split('T')[0];

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      throw new Error('Mind movie not found or access denied');
    }

    // Check if already completed today
    const existing = await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).eq('date', today)
      )
      .filter((q) => q.eq(q.field('mindMovieId'), args.mindMovieId))
      .first();

    if (existing?.morningCompleted) {
      return {
        trackingId: existing._id,
        xpEarned: existing.xpEarned || 0,
      };
    }

    // Calculate XP earned
    const xpEarned = 10;

    // If record exists but morning not completed, update it
    if (existing) {
      await ctx.db.patch(existing._id, {
        morningCompleted: true,
        morningTime: Date.now(),
        xpEarned: (existing.xpEarned || 0) + xpEarned,
      });

      return {
        trackingId: existing._id,
        xpEarned,
      };
    }

    // No existing record, create new one
    const trackingId = await ctx.db.insert('usageTracking', {
      userId: user._id,
      mindMovieId: args.mindMovieId,
      date: today,
      morningCompleted: true,
      eveningCompleted: false,
      morningTime: Date.now(),
      xpEarned,
    });

    return {
      trackingId,
      xpEarned,
    };
  },
});

// Record evening session
export const recordEvening = mutation({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.object({
    trackingId: v.id('usageTracking'),
    xpEarned: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const today = new Date().toISOString().split('T')[0];

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      throw new Error('Mind movie not found or access denied');
    }

    // Check if already completed today
    const existing = await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).eq('date', today)
      )
      .filter((q) => q.eq(q.field('mindMovieId'), args.mindMovieId))
      .first();

    if (existing?.eveningCompleted) {
      return {
        trackingId: existing._id,
        xpEarned: existing.xpEarned || 0,
      };
    }

    // Calculate XP earned (50% of morning XP)
    const xpEarned = 5;

    // If record exists but evening not completed, update it
    if (existing) {
      await ctx.db.patch(existing._id, {
        eveningCompleted: true,
        eveningTime: Date.now(),
        xpEarned: (existing.xpEarned || 0) + xpEarned,
      });

      return {
        trackingId: existing._id,
        xpEarned,
      };
    }

    // No existing record, create new one
    const trackingId = await ctx.db.insert('usageTracking', {
      userId: user._id,
      mindMovieId: args.mindMovieId,
      date: today,
      morningCompleted: false,
      eveningCompleted: true,
      eveningTime: Date.now(),
      xpEarned,
    });

    return {
      trackingId,
      xpEarned,
    };
  },
});

// Add notes to tracking
export const addNotes = mutation({
  args: {
    mindMovieId: v.id('mindMovies'),
    notes: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const today = new Date().toISOString().split('T')[0];

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      throw new Error('Mind movie not found or access denied');
    }

    const tracking = await ctx.db
      .query('usageTracking')
      .withIndex('by_userId_date', (q) =>
        q.eq('userId', user._id).eq('date', today)
      )
      .filter((q) => q.eq(q.field('mindMovieId'), args.mindMovieId))
      .first();

    if (!tracking) {
      return false;
    }

    await ctx.db.patch(tracking._id, {
      notes: args.notes,
    });

    return true;
  },
});
