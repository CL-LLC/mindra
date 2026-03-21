import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized: Please sign in");
  }
  return userId;
}

const statusValidator = v.union(v.literal("draft"), v.literal("rendering"), v.literal("ready"), v.literal("archived"));

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("mindMovies")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "ready"))
      .order("desc")
      .take(20);
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("mindMovies")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "archived"))
      .order("desc")
      .take(20);
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("mindMovies")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "ready"))
      .take(10);
  },
});

export const getById = query({
  args: {
    id: v.id("mindMovies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) return null;

    return mindMovie;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    goals: v.array(v.string()),
    affirmations: v.array(v.string()),
    storyboard: v.any(),
    assets: v.array(v.any()),
    duration: v.number(),
    musicTrack: v.optional(v.string()),
  },
  returns: v.id("mindMovies"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("mindMovies", {
      userId,
      title: args.title,
      version: 1,
      status: "draft",
      goals: args.goals,
      affirmations: args.affirmations,
      storyboard: args.storyboard,
      assets: args.assets,
      videoUrl: undefined,
      thumbnailUrl: undefined,
      duration: args.duration,
      musicTrack: args.musicTrack,
      effectivenessScore: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("mindMovies"), title: v.string(), goals: v.array(v.string()), affirmations: v.array(v.string()), storyboard: v.any(), assets: v.array(v.any()), duration: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    await ctx.db.patch(args.id, { title: args.title, goals: args.goals, affirmations: args.affirmations, storyboard: args.storyboard, assets: args.assets, duration: args.duration, status: "draft", videoUrl: undefined, videoStorageId: undefined, thumbnailUrl: undefined, updatedAt: Date.now() });
    return true;
  },
});

export const updateStatus = mutation({
  args: { id: v.id("mindMovies"), status: statusValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    if (args.status === "archived" && mindMovie.status === "rendering") {
      throw new Error("This Mind Movie is currently rendering. Wait for rendering to finish before archiving.");
    }
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
    return true;
  },
});

export const updateVideo = mutation({
  args: { id: v.id("mindMovies"), videoUrl: v.optional(v.string()), videoStorageId: v.optional(v.id("_storage")), status: v.optional(statusValidator) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    const updates: any = { updatedAt: Date.now() };
    if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl;
    if (args.videoStorageId !== undefined) updates.videoStorageId = args.videoStorageId;
    if (args.status !== undefined) updates.status = args.status;
    await ctx.db.patch(args.id, updates);
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("mindMovies") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    await ctx.db.delete(args.id);
    return true;
  },
});
