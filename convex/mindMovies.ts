import { internalMutation, mutation, query } from "./_generated/server";
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
const voiceRecordingValidator = v.object({
  affirmationIndex: v.number(),
  recordedAt: v.number(),
  mimeType: v.string(),
  audioDataUrl: v.string(),
  durationMs: v.optional(v.number()),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("mindMovies").withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "ready")).order("desc").take(20);
  },
});

export const listArchived = query({ args: {}, handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; return await ctx.db.query("mindMovies").withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "archived")).order("desc").take(20); } });
export const getActive = query({ args: {}, handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; return await ctx.db.query("mindMovies").withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "ready")).take(10); } });

export const getById = query({ args: { id: v.id("mindMovies") }, handler: async (ctx, args) => { const userId = await getAuthUserId(ctx); if (!userId) return null; const mindMovie = await ctx.db.get(args.id); if (!mindMovie || mindMovie.userId !== userId) return null; return mindMovie; } });

export const create = mutation({ args: { title: v.string(), language: v.optional(v.union(v.literal('en'), v.literal('es'))), goals: v.array(v.string()), affirmations: v.array(v.string()), storyboard: v.any(), assets: v.array(v.any()), duration: v.number(), musicTrack: v.optional(v.string()), affirmationManifest: v.optional(v.any()) }, returns: v.id("mindMovies"), handler: async (ctx, args) => { const userId = await requireUserId(ctx); const now = Date.now(); return await ctx.db.insert("mindMovies", { userId, title: args.title, language: args.language, version: 1, status: "draft", goals: args.goals, affirmations: args.affirmations, storyboard: args.storyboard, assets: args.assets, voiceRecordings: [], videoUrl: undefined, thumbnailUrl: undefined, duration: args.duration, musicTrack: args.musicTrack, effectivenessScore: undefined, affirmationManifest: args.affirmationManifest, createdAt: now, updatedAt: now }); } });

export const update = mutation({ args: { id: v.id("mindMovies"), title: v.string(), language: v.optional(v.union(v.literal('en'), v.literal('es'))), goals: v.array(v.string()), affirmations: v.array(v.string()), storyboard: v.any(), assets: v.array(v.any()), duration: v.number() }, returns: v.boolean(), handler: async (ctx, args) => { const userId = await requireUserId(ctx); const mindMovie = await ctx.db.get(args.id); if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied"); await ctx.db.patch(args.id, { title: args.title, language: args.language, goals: args.goals, affirmations: args.affirmations, storyboard: args.storyboard, assets: args.assets, duration: args.duration, status: "draft", videoUrl: undefined, videoStorageId: undefined, thumbnailUrl: undefined, updatedAt: Date.now() }); return true; } });

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
    if (args.status === "rendering") {
      await ctx.db.patch(args.id, {
        status: args.status,
        videoUrl: undefined,
        affirmationManifest: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
    }
    return true;
  },
});

/** Start a remote render job (sets job id + timestamp; used before enqueueing the worker). */
export const beginRemoteRender = mutation({
  args: { id: v.id("mindMovies"), renderJobId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    if (mindMovie.status === "rendering") throw new Error("This Mind Movie is already rendering.");
    if (mindMovie.status === "archived") throw new Error("Unarchive this Mind Movie before rendering.");
    await ctx.db.patch(args.id, {
      status: "rendering",
      renderJobId: args.renderJobId,
      renderStartedAt: Date.now(),
      renderError: undefined,
      videoUrl: undefined,
      affirmationManifest: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** If the worker enqueue HTTP call fails, move back to draft and surface an error. */
export const revertRenderingAfterEnqueueFailure = mutation({
  args: { id: v.id("mindMovies") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    if (mindMovie.status !== "rendering") return true;
    await ctx.db.patch(args.id, {
      status: "draft",
      renderJobId: undefined,
      renderStartedAt: undefined,
      renderError: "Could not reach the render service. Try again.",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const completeRenderFromWorker = internalMutation({
  args: {
    mindMovieId: v.id("mindMovies"),
    videoUrl: v.string(),
    affirmationManifest: v.optional(v.any()),
    renderJobId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie) return null;
    if (mindMovie.status !== "rendering") return null;
    if (
      args.renderJobId !== undefined &&
      mindMovie.renderJobId !== undefined &&
      args.renderJobId !== mindMovie.renderJobId
    ) {
      return null;
    }
    await ctx.db.patch(args.mindMovieId, {
      videoUrl: args.videoUrl,
      status: "ready",
      affirmationManifest: args.affirmationManifest,
      renderError: undefined,
      renderJobId: undefined,
      renderStartedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const failRenderFromWorker = internalMutation({
  args: {
    mindMovieId: v.id("mindMovies"),
    renderJobId: v.optional(v.string()),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mindMovie = await ctx.db.get(args.mindMovieId);
    if (!mindMovie) return null;
    if (mindMovie.status !== "rendering") return null;
    if (
      args.renderJobId !== undefined &&
      mindMovie.renderJobId !== undefined &&
      args.renderJobId !== mindMovie.renderJobId
    ) {
      return null;
    }
    await ctx.db.patch(args.mindMovieId, {
      status: "draft",
      renderError: args.message,
      renderJobId: undefined,
      renderStartedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const upsertVoiceRecording = mutation({
  args: { id: v.id("mindMovies"), recording: voiceRecordingValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    const existing = Array.isArray(mindMovie.voiceRecordings) ? mindMovie.voiceRecordings.filter((item: any) => item.affirmationIndex !== args.recording.affirmationIndex) : [];
    await ctx.db.patch(args.id, { voiceRecordings: [...existing, args.recording].sort((a: any, b: any) => a.affirmationIndex - b.affirmationIndex), updatedAt: Date.now() });
    return true;
  },
});

export const removeVoiceRecording = mutation({
  args: { id: v.id("mindMovies"), affirmationIndex: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied");
    const existing = Array.isArray(mindMovie.voiceRecordings) ? mindMovie.voiceRecordings.filter((item: any) => item.affirmationIndex !== args.affirmationIndex) : [];
    await ctx.db.patch(args.id, { voiceRecordings: existing, updatedAt: Date.now() });
    return true;
  },
});

export const updateVideo = mutation({ args: { id: v.id("mindMovies"), videoUrl: v.optional(v.string()), videoStorageId: v.optional(v.id("_storage")), status: v.optional(statusValidator), affirmationManifest: v.optional(v.any()) }, returns: v.boolean(), handler: async (ctx, args) => { const userId = await requireUserId(ctx); const mindMovie = await ctx.db.get(args.id); if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied"); const updates: any = { updatedAt: Date.now() }; if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl; if (args.videoStorageId !== undefined) updates.videoStorageId = args.videoStorageId; if (args.status !== undefined) updates.status = args.status; if (args.affirmationManifest !== undefined) updates.affirmationManifest = args.affirmationManifest; await ctx.db.patch(args.id, updates); return true; } });

export const updateAffirmationManifest = mutation({
  args: {
    id: v.id("mindMovies"),
    affirmationManifest: v.any(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const mindMovie = await ctx.db.get(args.id);
    if (!mindMovie || mindMovie.userId !== userId) {
      throw new Error("Mind movie not found or access denied");
    }
    await ctx.db.patch(args.id, {
      affirmationManifest: args.affirmationManifest,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const remove = mutation({ args: { id: v.id("mindMovies") }, returns: v.boolean(), handler: async (ctx, args) => { const userId = await requireUserId(ctx); const mindMovie = await ctx.db.get(args.id); if (!mindMovie || mindMovie.userId !== userId) throw new Error("Mind movie not found or access denied"); await ctx.db.delete(args.id); return true; } });
