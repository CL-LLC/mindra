# R2 + render worker setup

Operational steps for Cloudflare and deployment env (code lives in-repo; buckets and tokens are created in dashboards).

## Cloudflare R2 (beta)

1. **Bucket** — Create e.g. `mindra-videos-beta`.
2. **Public reads** — Enable R2 public bucket access **or** attach a **Custom Domain** (recommended: `videos.yourdomain.com`).
3. **CORS** — For the bucket, add a rule allowing `GET` from your Vercel preview and production origins so `<video src>` can load objects. If CORS is wrong, render/upload can succeed but the watch page video will fail in the browser.
4. **S3 API credentials** — R2 → Manage R2 API Tokens → create token with Object Read & Write on this bucket. Note **Account ID** for the S3 endpoint.

S3 endpoint format:

`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

## Convex

In the [Convex Dashboard](https://dashboard.convex.dev) → your deployment → **Settings → Environment Variables**:

- `RENDER_WEBHOOK_SECRET` — long random string; only Convex and the render worker know it.

Redeploy after changing variables.

## Vercel

Project → **Settings → Environment Variables**:

- `RENDER_WORKER_URL` — HTTPS base URL of the worker (e.g. `https://render.yourdomain.com`). Omit on machines that should use **local** ffmpeg rendering (see below).
- `RENDER_WORKER_SECRET` — shared with the worker; authenticates enqueue `POST` from this app.
- `NEXT_PUBLIC_CONVEX_URL` — already required.

Do **not** put R2 secret keys on Vercel if the worker is the only component uploading videos.

## Render worker host

Install **ffmpeg**, **python3** (for Kaleidoscope helper scripts), and **Node.js**. Set:

| Variable | Notes |
|----------|--------|
| `PORT` | Listen port (default `8790`) |
| `RENDER_WORKER_SECRET` | Same as Vercel |
| `RENDER_WEBHOOK_SECRET` | Same as Convex |
| `CONVEX_SITE_URL` | `https://<name>.convex.site` (HTTP actions live on `.convex.site`, not `.convex.cloud`) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_PUBLIC_BASE_URL` | Public URL prefix for objects (custom domain or `https://pub-xxxxx.r2.dev`), **no trailing slash** |
| `MODAL_FLUX_ENDPOINT_URL` | Required for video scene images; image generation intentionally does not fall back to OpenAI |
| `MODAL_FLUX_API_KEY` or `MODAL_TOKEN_SECRET` | Optional bearer token for the Modal FLUX endpoint |
| `PYTHON` | Optional override (default `python3`) |

Smoke-test: upload a small file with `aws s3 cp` using the same endpoint and keys ( `--endpoint-url` ), then open the resulting public URL from a browser page on the same origin as the app to verify public reads/CORS.

The worker now rejects request bodies above 10 MB, deduplicates in-flight `renderJobId` values, and applies a 30-second timeout to Convex render-complete/render-fail callbacks. This is still a lightweight MVP worker, not a durable queue; if the worker process crashes mid-render, the Convex movie can remain in `rendering` until a future stale-render recovery job is added.

## Content-Security-Policy (optional)

If you add a global CSP, include your R2 public origin in `media-src` so `<video src="https://…">` is allowed (along with `'self'`, `blob:`, and `data:` as needed).

## Vercel: legacy `/api/videos`

On Vercel, [`src/app/api/videos/[filename]/route.ts`](../src/app/api/videos/[filename]/route.ts) returns 404 unless `ENABLE_LOCAL_VIDEO_API=true` (not recommended for production).

## Local development without a worker

Leave `RENDER_WORKER_URL` unset. The app runs ffmpeg in the Next.js process and writes to `public/videos`, served via `/api/videos/...`.
