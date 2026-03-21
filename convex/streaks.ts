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

// Get streak for a mind movie
export const getByMindMovie = query({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      return null;
    }

    return await ctx.db
      .query('streaks')
      .withIndex('by_userId_mindMovieId', (q) =>
        q.eq('userId', user._id).eq('mindMovieId', args.mindMovieId)
      )
      .first();
  },
});

// Get all streaks for current user (bounded)
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    return await ctx.db
      .query('streaks')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .take(10); // Bounded - most users won't have more than 10 mind movies
  },
});

// Check if streak is at risk
export const checkAtRisk = query({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.object({
    atRisk: v.boolean(),
    currentStreak: v.number(),
    lastCompletedDate: v.optional(v.string()),
    daysSinceLastCompletion: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Verify ownership
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie || mindMovie.userId !== user._id) {
      return {
        atRisk: false,
        currentStreak: 0,
        lastCompletedDate: undefined,
        daysSinceLastCompletion: 0,
      };
    }

    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId_mindMovieId', (q) =>
        q.eq('userId', user._id).eq('mindMovieId', args.mindMovieId)
      )
      .first();

    if (!streak || streak.currentStreak === 0) {
      return {
        atRisk: false,
        currentStreak: 0,
        lastCompletedDate: undefined,
        daysSinceLastCompletion: 0,
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const completedToday = streak.lastCompletedDate === today;
    const completedYesterday = streak.lastCompletedDate === yesterday;

    // At risk if not completed today or yesterday
    const atRisk = !completedToday && !completedYesterday;

    // Calculate days since last completion
    let daysSince = 0;
    if (streak.lastCompletedDate) {
      const lastDate = new Date(streak.lastCompletedDate);
      const diffTime = Date.now() - lastDate.getTime();
      daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      atRisk,
      currentStreak: streak.currentStreak,
      lastCompletedDate: streak.lastCompletedDate,
      daysSinceLastCompletion: daysSince,
    };
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

// Initialize streak for new mind movie
export const initialize = mutation({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.id('streaks'),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    return await ctx.db.insert('streaks', {
      userId: user._id,
      mindMovieId: args.mindMovieId,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: '',
      streakFreezesUsed: 0,
      streakHistory: [],
    });
  },
});

// Increment streak
export const increment = mutation({
  args: {
    mindMovieId: v.id('mindMovies'),
  },
  returns: v.object({
    streakId: v.id('streaks'),
    currentStreak: v.number(),
    longestStreak: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const streak = await ctx.db
      .query('streaks')
      .withIndex('by_userId_mindMovieId', (q) =>
        q.eq('userId', user._id).eq('mindMovieId', args.mindMovieId)
      )
      .first();

    if (!streak) {
      const today = new Date().toISOString().split('T')[0];
      const streakId = await ctx.db.insert('streaks', {
        userId: user._id,
        mindMovieId: args.mindMovieId,
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedDate: today,
        streakFreezesUsed: 0,
        streakHistory: [today],
      });

      return {
        streakId,
        currentStreak: 1,
        longestStreak: 1,
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let newStreak = streak.currentStreak;
    let newLongestStreak = streak.longestStreak;

    if (streak.lastCompletedDate === today) {
      // Already completed today, don't increment
      return {
        streakId: streak._id,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
      };
    }

    if (streak.lastCompletedDate === yesterday) {
      // Completed yesterday, increment streak
      newStreak++;
      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak;
      }
    } else if (streak.lastCompletedDate !== today) {
      // Streak broken, reset
      newStreak = 1;
    }

    await ctx.db.patch(streak._id, {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastCompletedDate: today,
      streakHistory: [...(streak.streakHistory || []), today],
    });

    return {
      streakId: streak._id,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
    };
  },
});

// Use streak freeze
export const useFreeze = mutation({
  args: {
    streakId: v.id('streaks'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const streak = await ctx.db.get(args.streakId);
    if (!streak) {
      throw new Error('Streak not found');
    }

    if (streak.userId !== user._id) {
      throw new Error('Access denied');
    }

    if (streak.streakFreezesUsed >= 3) {
      throw new Error('No freezes available');
    }

    await ctx.db.patch(args.streakId, {
      streakFreezesUsed: streak.streakFreezesUsed + 1,
    });

    return true;
  },
});
