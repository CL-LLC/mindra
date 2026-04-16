import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function expectSecret(request: Request): Response | null {
  const expected = process.env.RENDER_WEBHOOK_SECRET;
  if (!expected) {
    return new Response("RENDER_WEBHOOK_SECRET not configured", { status: 500 });
  }
  const token = bearerToken(request);
  if (!token || !constantTimeEqual(token, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const renderComplete = httpAction(async (ctx, request) => {
  const authError = expectSecret(request);
  if (authError) return authError;

  let body: {
    mindMovieId?: string;
    videoUrl?: string;
    affirmationManifest?: unknown;
    renderJobId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.mindMovieId || !body.videoUrl) {
    return new Response("Missing mindMovieId or videoUrl", { status: 400 });
  }

  await ctx.runMutation(internal.mindMovies.completeRenderFromWorker, {
    mindMovieId: body.mindMovieId as any,
    videoUrl: body.videoUrl,
    affirmationManifest: body.affirmationManifest,
    renderJobId: body.renderJobId,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export const renderFail = httpAction(async (ctx, request) => {
  const authError = expectSecret(request);
  if (authError) return authError;

  let body: { mindMovieId?: string; renderJobId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.mindMovieId || !body.message) {
    return new Response("Missing mindMovieId or message", { status: 400 });
  }

  await ctx.runMutation(internal.mindMovies.failRenderFromWorker, {
    mindMovieId: body.mindMovieId as any,
    renderJobId: body.renderJobId,
    message: body.message,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
