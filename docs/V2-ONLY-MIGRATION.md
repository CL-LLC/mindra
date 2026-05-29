# Mindra V2-Only Migration and Deployment Notes

**Status:** Mindra now treats the V2 video pipeline as the only supported development path.

## Decision

Mindra development moves forward from the Hermes-managed repo:

```text
/Users/lucho/AgentOps/repos/mindra
```

The legacy OpenClaw workspace remains available for reference only:

```text
/Users/lucho/.openclaw/workspace/projects/ai-tools/mindra
```

Do not continue implementation in the OpenClaw workspace. If useful work exists there, inspect it and port it deliberately into the Hermes repo.

## Pipeline direction

- `getPipeline()` returns `V2Pipeline` directly.
- The old V1 default/fallback is retired.
- `EnvJobRouter` returns `v2`.
- `MINDRA_PIPELINE_VERSION=2` may remain in env files for older scripts and human clarity, but it no longer controls a V1/V2 production fallback.
- V1 files may remain temporarily for reference/parity tests, but active rendering should use V2.

## Image generation direction

Video scene image generation must use Modal FLUX.

Active pieces:

```text
modal/flux-image.py
src/lib/video/generators/modal-flux.ts
src/lib/video/generators/index.ts
```

Rules:

- `MODAL_FLUX_ENDPOINT_URL` is required for real image generation.
- Do not reintroduce OpenAI image generation, DALL-E, Qwen, or silent non-FLUX fallback for video scene images.
- OpenAI may still be used for unrelated text, clarity, Whisper, or TTS paths if current code needs it.

## Env vars by location

Never put real secret values in docs, GitHub issues, Discord, or committed files.

### Local `.env.local`

Used by local Next.js/dev tooling.

```env
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
CONVEX_SITE_URL=...
MINDRA_PIPELINE_VERSION=2
MODAL_FLUX_ENDPOINT_URL=...
MODAL_FLUX_API_KEY=...        # or use MODAL_TOKEN_SECRET
MODAL_TOKEN_SECRET=...        # optional if used as bearer token
OPENAI_API_KEY=...            # only where needed for text/TTS/clarity paths
```

Optional for local remote-worker tests:

```env
RENDER_WORKER_URL=...
RENDER_WORKER_SECRET=...
```

### Vercel

Used by the hosted Next.js app.

```env
NEXT_PUBLIC_CONVEX_URL=...
NEXT_PUBLIC_APP_URL=https://<vercel-or-production-domain>
MODAL_FLUX_ENDPOINT_URL=...
MODAL_FLUX_API_KEY=...        # or MODAL_TOKEN_SECRET, depending on deployed auth
RENDER_WORKER_URL=...         # production remote worker URL
RENDER_WORKER_SECRET=...
MINDRA_PIPELINE_VERSION=2     # optional legacy clarity; app is V2-only
```

If the app itself does not call R2 directly, do not put R2 secrets in Vercel. Keep R2 secrets on the render worker host.

### Convex dashboard

Used by Convex backend actions/routes.

```env
OPENAI_API_KEY=...            # if Convex AI actions use it
RENDER_WEBHOOK_SECRET=...     # must match render worker
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
JWKS=...
CONVEX_SITE_URL=...           # if referenced by Convex/backend flows
SITE_URL=...
```

Only set variables that current Convex code actually reads.

### Modal

Used to deploy/run the FLUX endpoint.

```env
MODAL_TOKEN_ID=...
MODAL_TOKEN_SECRET=...
MODAL_APP_NAME=mindra-flux
FLUX_MODEL_NAME=black-forest-labs/FLUX.2-klein   # optional override
```

Deploy command:

```bash
modal deploy modal/flux-image.py
```

### Render worker host

Used by `services/render-worker`.

```env
PORT=8790
RENDER_WORKER_SECRET=...
RENDER_WEBHOOK_SECRET=...
CONVEX_SITE_URL=https://<deployment>.convex.site
MODAL_FLUX_ENDPOINT_URL=...
MODAL_FLUX_API_KEY=...        # or MODAL_TOKEN_SECRET
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_BASE_URL=...
```

### Cloudflare R2

Required setup:

- Bucket exists.
- Worker credentials have write access.
- Public base URL/custom domain serves MP4s.
- CORS/public-read/browser playback is configured.
- Vercel/Next CSP, if present, allows the R2 public domain as `media-src`.

## GitHub / Vercel check

The local Git remote should be:

```bash
git remote -v
# origin https://github.com/CL-LLC/mindra.git
```

Vercel connection must be checked in the Vercel dashboard if CLI/project auth is unavailable:

1. Open Vercel dashboard.
2. Select Mindra project.
3. Confirm Git repository is `CL-LLC/mindra`.
4. Confirm production branch is the intended branch, usually `main`.
5. Add/update the Vercel env vars above.
6. Trigger a preview deployment after pushing the verified branch.

## Recommended verification before push

```bash
npx tsx src/lib/video/__tests__/flux-image-provider.test.ts
npx tsx src/lib/video/__tests__/flux-render-smoke.ts
npx tsx src/lib/video/__tests__/pipeline-parity.test.ts
npx tsc --noEmit
npm run build
npx convex dev --once
```

If `npx convex dev --once` fails due to missing local Convex login/linking, report it as an environment blocker rather than a code failure.
