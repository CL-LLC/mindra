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

// List notifications for current user (bounded)
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const limit = Math.min(args.limit ?? 20, 50); // Max 50

    return await ctx.db
      .query('notifications')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(limit);
  },
});

// Get unread count
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('opened'), false))
      .take(100); // Bounded

    return unread.length;
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

// Mark notification as opened
export const markOpened = mutation({
  args: {
    id: v.id('notifications'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.id);

    // Authorization check
    if (!notification || notification.userId !== user._id) {
      throw new Error('Notification not found or access denied');
    }

    await ctx.db.patch(args.id, { opened: true });
    return true;
  },
});

// Mark all as opened
export const markAllOpened = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('opened'), false))
      .take(100);

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { opened: true });
    }

    return unread.length;
  },
});

// Mark action taken
export const markActionTaken = mutation({
  args: {
    id: v.id('notifications'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(args.id);

    if (!notification || notification.userId !== user._id) {
      throw new Error('Notification not found or access denied');
    }

    await ctx.db.patch(args.id, {
      actionTaken: true,
      opened: true,
    });

    return true;
  },
});

// ============================================
// INTERNAL MUTATIONS (for cron jobs / backend)
// ============================================

// Internal: Create notification
export const internalCreate = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.union(
      v.literal('morning_reminder'),
      v.literal('evening_reminder'),
      v.literal('streak_at_risk'),
      v.literal('streak_lost'),
      v.literal('goal_achieved'),
      v.literal('level_up')
    ),
  },
  returns: v.id('notifications'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      sentAt: Date.now(),
      opened: false,
      actionTaken: false,
    });
  },
});

// Internal: Send reminder notification
export const internalSendReminder = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.union(v.literal('morning_reminder'), v.literal('evening_reminder')),
  },
  returns: v.id('notifications'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      sentAt: Date.now(),
      opened: false,
      actionTaken: false,
    });
  },
});

// Internal: Update user level
export const internalUpdateLevel = internalMutation({
  args: {
    userId: v.id('users'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return false;
    }

    const level = user.level ?? 1;
    const xp = user.xp ?? 0;
    const xpToNextLevel = level * 500;
    if (xp >= xpToNextLevel) {
      await ctx.db.patch(args.userId, {
        level: level + 1,
        xp: xp - xpToNextLevel,
      });

      // Award level up notification
      await ctx.db.insert('notifications', {
        userId: args.userId,
        type: 'level_up',
        sentAt: Date.now(),
        opened: false,
        actionTaken: false,
      });

      return true;
    }

    return false;
  },
});
