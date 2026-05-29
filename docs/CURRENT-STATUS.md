# Mindra Current Status

**Last updated:** 2026-05-12 11:22 -05  
**Purpose:** Restart baseline for Mindra development. This document captures the verified current repo/project status before new implementation work resumes.

---

## 1. Repository Baseline

| Item | Status |
|---|---|
| Local repo | `/Users/lucho/AgentOps/repos/mindra` |
| GitHub repo | `CL-LLC/mindra` |
| Remote | `https://github.com/CL-LLC/mindra.git` |
| Default branch | `main` |
| Current local branch | `main` |
| Current HEAD | `d26837f` — `fix: align narration tracks with scene recordings` |
| Working tree | Clean at time of baseline, before creating this doc |
| Open GitHub PRs | 0 |
| Open GitHub issues | 0 |

Repo hygiene performed on 2026-05-12:

- Switched from stale local branch `fix/narration-track-strategy` to `main`.
- Fast-forwarded local `main` from `a6233e0` to `d26837f`.
- Removed stale local branch `fix/narration-track-strategy` after verifying its patch was already present on `origin/main`.
- Left unrelated local branch `agent/eslint-config-noninteractive` untouched.

---

## 2. Latest GitHub Activity

Latest verified commits on `origin/main`:

```text
d26837f 2026-04-25 fix: align narration tracks with scene recordings
a6233e0 2026-04-20 Merge pull request #40 from CL-LLC/fix/mindra-v2-audio-cleanup
86dbc4f 2026-04-20 fix: clean up mindra v2 narration pipeline
c17b4c2 2026-04-19 Fix V2 narration audio resolution
fd111b4 2026-04-19 feat: add Modal FLUX.2 klein 4B image generation provider
f3d8c18 2026-04-18 feat: wire MINDRA_PIPELINE_VERSION flag into render-worker + add pipeline selection logging
ea00191 2026-04-18 MINDRA-0074: Batch 3 full regression pass — all parity tests pass, V2 ready for flagged lane
cf16e5a 2026-04-18 feat(MINDRA-0073): port V1 pair-cycling narration into V2 buildNarrationTracks
```

Recent development theme:

- V2 video pipeline parity and cleanup.
- Narration/audio alignment fixes.
- Modal FLUX.2 image provider integration.
- Render-worker pipeline flagging.
- Regression/eval documentation.

---

## 3. Product / Architecture Snapshot

Mindra is a Next.js + Convex SaaS for AI-powered “mind movies”: short motivational/visualization videos created from goals, affirmations, storyboards, generated imagery, narration/audio, and rendered video assets.

Current key areas:

| Area | Path |
|---|---|
| Next.js app | `src/app/` |
| Convex backend | `convex/` |
| Video rendering pipeline | `src/lib/video/` |
| Render worker | `services/render-worker/` |
| Modal deployments / FLUX support | `modal/` |
| Evaluation docs | `docs/eval/` |

Package scripts:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "convex": "convex dev",
  "render-worker": "tsx services/render-worker/src/server.ts"
}
```

No root `AGENTS.md` exists in the repo as of this baseline.

---

## 4. V2 Video Pipeline Status

Source of truth: `docs/eval/BATCH3-RESULTS.md` and recent commits.

Current assessment:

> V2 is ready for controlled flagged-lane testing, not yet an unconditional production default.

Confirmed from Batch 3 regression docs:

- V2 parity harness passed across 3 fixtures.
- 6 of 7 original V1/V2 parity gaps are fully closed.
- Remaining item is `GAP-5`: FFmpeg quality preset is hardcoded to `medium` rather than V1's quality-based preset.
- V2 remains opt-in via `MINDRA_PIPELINE_VERSION=2`.
- Factory/default behavior remains V1, reducing production risk.

Remaining V2 caveats:

- Batch 3 used synthetic fallback because no real API key was set.
- Real generation paths still need controlled testing with production-like API keys and environment.
- GAP-5 should be fixed as a follow-up cleanup.

Recommended V2 next step:

1. Run the existing parity/smoke tests locally.
2. Validate with real API keys in a controlled environment.
3. Enable `MINDRA_PIPELINE_VERSION=2` for a narrow flagged lane only.
4. Monitor render success rate, duration, logs, and output quality.
5. Promote only after real-world validation.

---

## 5. Auth / Deployment Status

Source of truth: `docs/MINDRA-0051-0053-AUDIT.md` plus current repo inspection.

Current assessment:

- Runtime auth is already on Convex native auth.
- Google OAuth was previously user-confirmed working.
- Email magic-link path is part of the intended MVP auth path.
- Some stale Clerk references/dependencies may remain in package/docs/env examples.

Main blockers before beta deployment:

1. Remove stale Clerk references/dependencies where they are no longer valid.
2. Confirm production environment variables for:
   - Convex
   - Google OAuth
   - email/magic-link provider
   - render/image/audio providers
3. Deploy preview to Vercel.
4. Smoke test hosted app:
   - landing page
   - Google sign-in
   - email magic link
   - dashboard access
   - create flow load
   - logout/relogin
   - render request path

---

## 6. Known Risks / Open Questions

### Technical risks

- V2 has strong synthetic/parity evidence but still needs live-provider testing.
- FFmpeg/audio mixing remains a sensitive part of the system.
- Render-worker environment parity with local/dev needs verification.
- Stale docs may still reference older plans such as Editly, SDXL, R2, or Clerk; current implementation has moved toward Modal FLUX and Convex Auth.

### Repo/process risks

- GitHub currently has no open issues or PRs, so active work is not represented as an execution board.
- There is at least one unrelated local-only branch: `agent/eslint-config-noninteractive`.
- No root `AGENTS.md` exists to encode repo-specific operating rules.

### Product/beta risks

- Beta readiness depends less on architecture now and more on environment setup, deployment, smoke testing, and one complete user journey.
- The product should not move to broader tester rollout until hosted auth and at least one create/render/watch path are validated.

---

## 7. Recommended Next Plan

### Phase A — Baseline verification

Run lightweight/targeted checks before any new feature work:

```bash
npx tsx src/lib/video/__tests__/pipeline-parity.test.ts
npx tsx src/lib/video/__tests__/batch2-parity.ts
npx tsx src/lib/video/__tests__/flux-image-provider.test.ts
npx tsx src/lib/video/__tests__/flux-render-smoke.ts
npm run lint
npx tsc --noEmit
npm run build
```

If Convex backend/API shape changed or generated files are suspect, also run:

```bash
npx convex dev --once
```

### Phase B — Deployment cleanup

- Remove stale Clerk references/dependencies if confirmed unused.
- Update `.env.example` and docs to match Convex Auth + Modal FLUX reality.
- Confirm required Vercel/Convex env vars.

### Phase C — Beta preview

- Deploy Vercel preview.
- Smoke test auth and app shell.
- Validate one complete user journey:
  1. sign in
  2. create goal/content
  3. generate or queue render
  4. view/watch output
  5. track completion if applicable

### Phase D — V2 flagged lane

- Enable `MINDRA_PIPELINE_VERSION=2` only in a controlled test lane.
- Run live-provider render tests.
- Compare V1 vs V2 output quality and logs.
- Fix GAP-5 dynamic FFmpeg preset.
- Decide whether V2 can become default.

---

## 8. Immediate Recommended Work Order

Next agent task should be:

> Run baseline verification checks on clean `main`, report failures only, and do not implement fixes unless explicitly approved.

After that, the project can move into a focused cleanup/deployment sprint.
