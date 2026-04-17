/**
 * Long-running render worker: accepts jobs from Next.js, runs ffmpeg, uploads to R2, callbacks Convex.
 * Run from repo root: `npm run render-worker`
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { renderVideo } from '../../../src/lib/video/render-executor';
import type { RenderJobPayload } from './types';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function bearer(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function postConvex(path: string, payload: Record<string, unknown>) {
  const base = requireEnv('CONVEX_SITE_URL').replace(/\/$/, '');
  const secret = requireEnv('RENDER_WEBHOOK_SECRET');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Convex webhook ${path} failed: ${r.status} ${t}`);
  }
}

async function runJob(payload: RenderJobPayload) {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const bucket = requireEnv('R2_BUCKET_NAME');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
  const publicBase = requireEnv('R2_PUBLIC_BASE_URL').replace(/\/$/, '');

  const options = {
    width: payload.options?.width ?? 1280,
    height: payload.options?.height ?? 720,
    fps: payload.options?.fps ?? 30,
    quality: payload.options?.quality ?? ('medium' as const),
    musicTrack: payload.options?.musicTrack,
  };

  const videoBuffer = await renderVideo(payload.scenes, options);
  const key = `mind-movies/${payload.mindMovieId}/${randomUUID()}.mp4`;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    })
  );

  const videoUrl = `${publicBase}/${key}`;

  await postConvex('/render-complete', {
    mindMovieId: payload.mindMovieId,
    videoUrl,
    affirmationManifest: payload.affirmationManifest,
    renderJobId: payload.renderJobId,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url?.split('?')[0] === '/health') {
      jsonResponse(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST' || req.url?.split('?')[0] !== '/render-job') {
      jsonResponse(res, 404, { error: 'Not found' });
      return;
    }

    const expected = requireEnv('RENDER_WORKER_SECRET');
    const token = bearer(req);
    if (!token || !constantTimeEqual(token, expected)) {
      jsonResponse(res, 401, { error: 'Unauthorized' });
      return;
    }

    let raw: unknown;
    try {
      raw = await readJsonBody(req);
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const body = raw as Partial<RenderJobPayload>;
    if (!body.mindMovieId || !body.renderJobId || !Array.isArray(body.scenes)) {
      jsonResponse(res, 400, { error: 'Missing mindMovieId, renderJobId, or scenes' });
      return;
    }

    const payload: RenderJobPayload = {
      mindMovieId: body.mindMovieId,
      renderJobId: body.renderJobId,
      scenes: body.scenes,
      options: body.options,
      affirmationManifest: body.affirmationManifest,
    };

    jsonResponse(res, 202, { accepted: true, renderJobId: payload.renderJobId });

    void runJob(payload).catch(async (err: Error) => {
      console.error('[render-worker] job failed', err);
      try {
        await postConvex('/render-fail', {
          mindMovieId: payload.mindMovieId,
          renderJobId: payload.renderJobId,
          message: err.message || 'Render failed',
        });
      } catch (e) {
        console.error('[render-worker] fail webhook error', e);
      }
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      jsonResponse(res, 500, { error: e instanceof Error ? e.message : 'Server error' });
    }
  }
});

const port = Number(process.env.PORT) || 8790;
server.listen(port, () => {
  console.log(`[render-worker] listening on :${port}`);
});
