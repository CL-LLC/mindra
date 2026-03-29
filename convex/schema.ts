import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const voiceRecordingValidator = v.object({
  affirmationIndex: v.number(),
  recordedAt: v.number(),
  mimeType: v.string(),
  audioDataUrl: v.string(),
  durationMs: v.optional(v.number()),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    timezone: v.optional(v.string()),
    preferredLanguage: v.optional(v.union(v.literal("en"), v.literal("es"))),
    subscription: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("ultra"))),
    xp: v.optional(v.number()),
    level: v.optional(v.number()),
    badges: v.optional(v.array(v.string())),
    streakFreezesAvailable: v.optional(v.number()),
    morningReminderTime: v.optional(v.string()),
    eveningReminderTime: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  mindMovies: defineTable({
    userId: v.id("users"),
    title: v.string(),
    language: v.optional(v.union(v.literal('en'), v.literal('es'))),
    version: v.number(),
    status: v.union(v.literal("draft"), v.literal("rendering"), v.literal("ready"), v.literal("archived")),
    goals: v.array(v.string()),
    affirmations: v.array(v.string()),
    storyboard: v.any(),
    assets: v.array(v.any()),
    voiceRecordings: v.optional(v.array(voiceRecordingValidator)),
    videoUrl: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
    thumbnailUrl: v.optional(v.string()),
    duration: v.number(),
    musicTrack: v.optional(v.string()),
    effectivenessScore: v.optional(v.number()),
    // Playback-layer manifest for affirmation overlay (optional, added for balanced architecture)
    affirmationManifest: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  usageTracking: defineTable({
    userId: v.id("users"),
    mindMovieId: v.id("mindMovies"),
    date: v.string(),
    morningCompleted: v.boolean(),
    eveningCompleted: v.boolean(),
    morningTime: v.optional(v.number()),
    eveningTime: v.optional(v.number()),
    xpEarned: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId_mindMovieId", ["userId", "mindMovieId"]),

  streaks: defineTable({
    userId: v.id("users"),
    mindMovieId: v.id("mindMovies"),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedDate: v.string(),
    streakFreezesUsed: v.number(),
    streakHistory: v.array(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_mindMovieId", ["userId", "mindMovieId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("morning_reminder"),
      v.literal("evening_reminder"),
      v.literal("streak_at_risk"),
      v.literal("streak_lost"),
      v.literal("goal_achieved"),
      v.literal("level_up")
    ),
    sentAt: v.number(),
    opened: v.boolean(),
    actionTaken: v.boolean(),
  }).index("by_userId", ["userId"]),

  achievements: defineTable({
    userId: v.id("users"),
    badgeId: v.string(),
    earnedAt: v.number(),
    xpAwarded: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_badgeId", ["userId", "badgeId"]),
});
