# Mindra 2-Week Development Plan

**Created:** 2026-02-27  
**Duration:** 14 days (2 weeks)  
**Goal:** Get Mindra MVP to a testable, functional state

---

## Agent Assignment Key

| Agent | Model | Best For |
|-------|-------|----------|
| **Builder** | GLM-5 | Implementation, coding, UI components |
| **Sage** | GLM-4.7 | Analysis, testing, documentation, debugging |
| **Architect** | GPT-5.3-Codex | Complex architecture, video pipeline, integrations |

---

# PHASE 1: Foundation Fixes (Days 1-4) ⚠️ PRIORITY

These are critical blockers preventing basic functionality.

---

## 🔴 P1-01: Fix Auth System User Lookup Bug
- [ ] **Description:** The `mindMovies.ts` and other files query users by email using `userId` from `getAuthUserId()`. This is incorrect - `getAuthUserId()` returns the auth user ID, not an email. Need to fix the user lookup logic across all Convex functions.
- **Est. Time:** 2 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `convex/mindMovies.ts`, `convex/streaks.ts`, `convex/tracking.ts`, `convex/notifications.ts`

---

## 🔴 P1-02: Fix Tracking Record Creation Bug
- [ ] **Description:** `tracking.ts` creates new records for morning AND evening sessions separately, causing duplicate records for same day. Should update existing record if one exists.
- **Est. Time:** 1.5 hours
- **Dependencies:** P1-01
- **Assignee:** Builder (GLM-5)
- **Files:** `convex/tracking.ts`

---

## 🔴 P1-03: Add Video Player Component
- [ ] **Description:** Create a video player component for watching mind movies. Should support play/pause, progress bar, fullscreen, and track completion events.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/components/VideoPlayer.tsx` (NEW)

---

## 🔴 P1-04: Wire Video Player to Dashboard
- [ ] **Description:** Integrate VideoPlayer component into dashboard page. Show thumbnail, play button, and link to watch page.
- **Est. Time:** 2 hours
- **Dependencies:** P1-03
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/dashboard/page.tsx`, `src/app/watch/page.tsx` (NEW)

---

## 🔴 P1-05: Create Watch Page with Tracking Integration
- [ ] **Description:** Create `/watch/[id]` page that plays mind movie and calls `tracking.recordMorning` or `tracking.recordEvening` when video completes.
- **Est. Time:** 3 hours
- **Dependencies:** P1-02, P1-03
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/watch/[id]/page.tsx` (NEW)

---

## 🔴 P1-06: Fix Streak Update Logic
- [ ] **Description:** Streaks should update when user completes BOTH morning AND evening sessions. Currently there's no integration between tracking and streaks.
- **Est. Time:** 2 hours
- **Dependencies:** P1-02
- **Assignee:** Sage (GLM-4.7)
- **Files:** `convex/streaks.ts`, `convex/tracking.ts`

---

## 🟡 P1-07: Add Error Boundaries
- [ ] **Description:** Add React error boundaries around key sections to prevent full app crashes on errors.
- **Est. Time:** 1.5 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/components/ErrorBoundary.tsx` (NEW), `src/app/layout.tsx`

---

## 🟡 P1-08: Add Loading States
- [ ] **Description:** Add proper loading skeletons to all pages that fetch data (dashboard, stats, settings).
- **Est. Time:** 1.5 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/components/LoadingSkeleton.tsx` (NEW), all page files

---

**Phase 1 Total:** ~16.5 hours

---

# PHASE 2: Core Features (Days 5-10)

Building the main value proposition - video creation and tracking.

---

## 🔵 P2-01: Set Up Editly Video Pipeline
- [ ] **Description:** Install and configure Editly for video rendering. Create basic pipeline that can stitch images with text overlays and music.
- **Est. Time:** 4 hours
- **Dependencies:** None
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/lib/video/editly-pipeline.ts` (NEW), `package.json`

---

## 🔵 P2-02: Create Storyboard-to-Video Converter
- [ ] **Description:** Build function that takes storyboard JSON and generates Editly config. Handle scene transitions, text overlays, Ken Burns effects.
- **Est. Time:** 4 hours
- **Dependencies:** P2-01
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/lib/video/storyboard-converter.ts` (NEW)

---

## 🔵 P2-03: Add Local SDXL Image Generation
- [ ] **Description:** Set up local Stable Diffusion XL integration on Mac Studio. Create API endpoint that generates images from prompts.
- **Est. Time:** 5 hours
- **Dependencies:** None
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/app/api/generate-image/route.ts` (NEW), `src/lib/ai/sdxl.ts` (NEW)

---

## 🔵 P2-04: Create Asset Generation Flow
- [ ] **Description:** Build the flow that takes storyboard scenes and generates/collects assets (images from SDXL, stock from Pexels, user uploads).
- **Est. Time:** 4 hours
- **Dependencies:** P2-03
- **Assignee:** Builder (GLM-5)
- **Files:** `src/lib/assets/generator.ts` (NEW), `convex/assets.ts` (NEW)

---

## 🔵 P2-05: Integrate Cloudflare R2 Storage
- [ ] **Description:** Set up R2 bucket and create upload/download functions for videos and images.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/lib/storage/r2.ts` (NEW), `.env` updates

---

## 🔵 P2-06: Create Video Rendering Job System
- [ ] **Description:** Build a job queue for video rendering. Handle status updates (draft → rendering → ready), error recovery, and progress tracking.
- **Est. Time:** 4 hours
- **Dependencies:** P2-01, P2-05
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `convex/renderJobs.ts` (NEW), `src/app/api/render/route.ts` (NEW)

---

## 🔵 P2-07: Build Create Flow Step 2: Affirmation Editor
- [ ] **Description:** Create UI for editing AI-generated affirmations before video creation. Allow add/remove/edit affirmations.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/create/affirmations/page.tsx` (NEW)

---

## 🔵 P2-08: Build Create Flow Step 3: Asset Selection
- [ ] **Description:** Create UI for selecting/uploading images for each scene. Show AI suggestions, allow uploads, Pexels search integration.
- **Est. Time:** 4 hours
- **Dependencies:** P2-04
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/create/assets/page.tsx` (NEW)

---

## 🔵 P2-09: Build Create Flow Step 4: Music Selection
- [ ] **Description:** Create UI for selecting background music. Integrate Uppbeat free tracks or allow upload.
- **Est. Time:** 2 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/create/music/page.tsx` (NEW), `src/lib/music/tracks.ts` (NEW)

---

## 🔵 P2-10: Wire End-to-End Video Creation
- [ ] **Description:** Connect all create flow steps. When user clicks "Create Video", trigger rendering job and redirect to dashboard.
- **Est. Time:** 3 hours
- **Dependencies:** P2-06, P2-07, P2-08, P2-09
- **Assignee:** Sage (GLM-4.7)
- **Files:** `src/app/create/preview/page.tsx` (NEW)

---

## 🔵 P2-11: Telegram Bot Setup
- [ ] **Description:** Create Telegram bot for notifications. Set up webhook and basic command handling.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/app/api/telegram/webhook/route.ts` (NEW), `src/lib/telegram/bot.ts` (NEW)

---

## 🔵 P2-12: Wire Telegram to Notification System
- [ ] **Description:** Connect Telegram bot to Convex notification system. Send morning/evening reminders via Telegram.
- **Est. Time:** 2 hours
- **Dependencies:** P2-11
- **Assignee:** Builder (GLM-5)
- **Files:** `convex/notifications.ts`, `src/lib/telegram/notify.ts` (NEW)

---

**Phase 2 Total:** ~41 hours

---

# PHASE 3: Polish (Days 11-14)

Making it production-ready and delightful.

---

## 🟢 P3-01: Add Kaleidoscope Intro/Outro Effects
- [ ] **Description:** Create kaleidoscope video effects for intro and outro sequences. Add to Editly pipeline.
- **Est. Time:** 4 hours
- **Dependencies:** P2-01
- **Assignee:** Architect (GPT-5.3-Codex)
- **Files:** `src/lib/video/effects/kaleidoscope.ts` (NEW)

---

## 🟢 P3-02: Add Ken Burns Effect to Images
- [ ] **Description:** Implement Ken Burns (pan/zoom) effect on static images in videos.
- **Est. Time:** 2 hours
- **Dependencies:** P2-01
- **Assignee:** Builder (GLM-5)
- **Files:** `src/lib/video/effects/kenburns.ts` (NEW)

---

## 🟢 P3-03: Improve Dashboard UI
- [ ] **Description:** Polish dashboard with better cards, animations, and empty states. Add quick actions.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/dashboard/page.tsx`, `src/components/DashboardCard.tsx` (NEW)

---

## 🟢 P3-04: Add Gamification Elements
- [ ] **Description:** Add XP animations, level-up celebrations, badge unlocks. Make it feel rewarding.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/components/Gamification/` (NEW folder)

---

## 🟢 P3-05: Create Onboarding Flow
- [ ] **Description:** Build first-time user onboarding. Explain concept, guide through first mind movie creation.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** `src/app/onboarding/page.tsx` (NEW)

---

## 🟢 P3-06: Add Streak Freeze Feature
- [ ] **Description:** Allow users to "freeze" their streak for a day. Limit to 3 freezes. Add UI for this.
- **Est. Time:** 2 hours
- **Dependencies:** P1-06
- **Assignee:** Sage (GLM-4.7)
- **Files:** `convex/streaks.ts`, `src/app/settings/page.tsx`

---

## 🟢 P3-07: Mobile Responsiveness
- [ ] **Description:** Ensure all pages work well on mobile. Test and fix layout issues.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Builder (GLM-5)
- **Files:** All page files, `tailwind.config.ts`

---

## 🟢 P3-08: Add Analytics Events
- [ ] **Description:** Track key events (video created, video watched, streak milestones) for future optimization.
- **Est. Time:** 2 hours
- **Dependencies:** None
- **Assignee:** Sage (GLM-4.7)
- **Files:** `src/lib/analytics/events.ts` (NEW), all page files

---

## 🟢 P3-09: Write E2E Tests
- [ ] **Description:** Create Playwright tests for critical flows (sign up, create video, watch video, track session).
- **Est. Time:** 4 hours
- **Dependencies:** None
- **Assignee:** Sage (GLM-4.7)
- **Files:** `tests/e2e/` (NEW folder)

---

## 🟢 P3-10: Performance Optimization
- [ ] **Description:** Audit bundle size, add lazy loading, optimize images, add caching headers.
- **Est. Time:** 3 hours
- **Dependencies:** None
- **Assignee:** Sage (GLM-4.7)
- **Files:** `next.config.mjs`, all component files

---

**Phase 3 Total:** ~29 hours

---

# Summary

| Phase | Tasks | Est. Hours | Priority |
|-------|-------|------------|----------|
| Phase 1: Foundation | 8 tasks | ~16.5h | 🔴 Critical |
| Phase 2: Core Features | 12 tasks | ~41h | 🔵 High |
| Phase 3: Polish | 10 tasks | ~29h | 🟢 Medium |
| **TOTAL** | **30 tasks** | **~86.5h** | |

---

# Agent Workload Distribution

| Agent | Tasks | Est. Hours |
|-------|-------|------------|
| Builder (GLM-5) | 16 tasks | ~47h |
| Sage (GLM-4.7) | 8 tasks | ~23h |
| Architect (GPT-5.3-Codex) | 6 tasks | ~23h |

---

# Critical Path

```
P1-01 → P1-02 → P1-06 → P3-06
    ↘
     P1-03 → P1-04 → P1-05
              ↗
P2-01 → P2-02 → P2-06 → P2-10
    ↘
     P2-03 → P2-04 → P2-08
```

**Longest path:** P2-01 → P2-02 → P2-06 → P2-10 (~15 hours, can be parallelized with Phase 1)

---

# Daily Schedule Suggestion

| Day | Focus | Tasks |
|-----|-------|-------|
| 1 | Auth Fixes | P1-01, P1-02 |
| 2 | Video Player | P1-03, P1-04, P1-05 |
| 3 | Tracking & Streaks | P1-06, P1-07, P1-08 |
| 4 | Buffer/Catch-up | Complete Phase 1 |
| 5 | Video Pipeline | P2-01, P2-02 |
| 6 | Image Generation | P2-03, P2-04 |
| 7 | Storage & Jobs | P2-05, P2-06 |
| 8 | Create Flow UI | P2-07, P2-08, P2-09 |
| 9 | End-to-End | P2-10, P2-11 |
| 10 | Notifications | P2-12, buffer |
| 11 | Effects | P3-01, P3-02 |
| 12 | UI Polish | P3-03, P3-04, P3-05 |
| 13 | Features | P3-06, P3-07, P3-08 |
| 14 | Testing | P3-09, P3-10, final review |

---

# Notes

1. **Parallelization:** Phase 1 and Phase 2 can run in parallel with different agents
2. **Buffer:** Each phase has ~10% buffer built in for unexpected issues
3. **Testing:** Continuous testing throughout, not just Phase 3
4. **Documentation:** Update docs as we go, not at the end

---

**Plan Status:** ✅ Ready for execution
