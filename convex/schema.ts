import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users table
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    telegramId: v.optional(v.string()),
    pushToken: v.optional(v.string()),
    timezone: v.string(),
    subscription: v.union(
      v.literal('free'),
      v.literal('pro'),
      v.literal('ultra')
    ),
    xp: v.number(),
    level: v.number(),
    badges: v.array(v.string()),
    streakFreezesAvailable: v.number(),
    morningReminderTime: v.optional(v.string()),
    eveningReminderTime: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_clerkId', ['clerkId']),

  // Mind Movies table
  mindMovies: defineTable({
    userId: v.id('users'),
    title: v.string(),
    version: v.number(),
    status: v.union(
      v.literal('draft'),
      v.literal('rendering'),
      v.literal('ready'),
      v.literal('archived')
    ),
    goals: v.array(v.string()),
    affirmations: v.array(v.string()),
    storyboard: v.any(), // StoryboardJSON
    assets: v.array(v.any()), // Asset[]
    videoUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.number(),
    musicTrack: v.optional(v.string()),
    effectivenessScore: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_status', ['userId', 'status']),

  // Usage Tracking table
  usageTracking: defineTable({
    userId: v.id('users'),
    mindMovieId: v.id('mindMovies'),
    date: v.string(), // YYYY-MM-DD
    morningCompleted: v.boolean(),
    eveningCompleted: v.boolean(),
    morningTime: v.optional(v.number()),
    eveningTime: v.optional(v.number()),
    xpEarned: v.number(),
    notes: v.optional(v.string()),
  })
    .index('by_userId_date', ['userId', 'date'])
    .index('by_userId_mindMovieId', ['userId', 'mindMovieId']),

  // Streaks table
  streaks: defineTable({
    userId: v.id('users'),
    mindMovieId: v.id('mindMovies'),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedDate: v.string(),
    streakFreezesUsed: v.number(),
    streakHistory: v.array(
      v.object({
        date: v.string(),
        morningCompleted: v.boolean(),
        eveningCompleted: v.boolean(),
        xpEarned: v.number(),
      })
    ),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_mindMovieId', ['userId', 'mindMovieId']),

  // Notifications table
  notifications: defineTable({
    userId: v.id('users'),
    type: v.union(
      v.literal('morning_reminder'),
      v.literal('evening_reminder'),
      v.literal('streak_at_risk'),
      v.literal('streak_lost'),
      v.literal('goal_achieved'),
      v.literal('level_up')
    ),
    sentAt: v.number(),
    opened: v.boolean(),
    actionTaken: v.boolean(),
  }).index('by_userId', ['userId']),

  // Achievements/Badges table
  achievements: defineTable({
    userId: v.id('users'),
    badgeId: v.string(),
    earnedAt: v.number(),
    xpAwarded: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_badgeId', ['userId', 'badgeId']),
});
