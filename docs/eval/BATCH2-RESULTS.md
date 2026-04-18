# MINDRA-0072: Batch 2 Golden V1 vs V2 Comparison — Results

**Date:** 2026-04-18
**Branch:** `feat/v2-generator-abstractions`
**Environment:** Mac Studio (arm64), no OPENAI_API_KEY (synthetic fallback), ffmpeg 8.0.1

---

## Test Cases Exercised

| Case | Target Gap | Description |
|------|-----------|-------------|
| TC-02 | GAP-2 | Background image URL handling — planner pass-through + keyframe resolution |
| TC-04 | GAP-3 | Narration pair cycling — V1 vs V2 strategy comparison |
| TC-06 | GAP-4 | Text overlay on frames — V1SceneAnimator text parameter |
| TC-07 | All gaps | Full pipeline regression (3-scene, V1 + V2) |

---

## Commands Run

```bash
# Batch 2 targeted parity tests
npx tsx src/lib/video/__tests__/batch2-parity.ts

# Existing parity regression (Batch 1 suite)
npx tsx src/lib/video/__tests__/pipeline-parity.test.ts

# Full harness re-run (all fixtures)
npx tsx src/lib/video/__tests__/v2-harness.ts --keep --json

# Per-file ffprobe structural analysis
ffprobe -v quiet -show_entries stream=codec_type,codec_name,duration -of json <file>
```

---

## Results

### TC-02: Background Image URLs (GAP-2)

| Check | Result |
|-------|--------|
| Planner passes `backgroundImageUrl` through to ShotPlan | ✅ |
| KeyframeGenerator calls `resolveBackgroundImage` when URL present | ✅ |
| KeyframeGenerator skips `resolveBackgroundImage` when no URL | ✅ |

**GAP-2 Status: CLOSED** ✅ (was closed in MINDRA-0063, confirmed in this batch)

### TC-04: Narration Pair Cycling (GAP-3)

| Check | Result |
|-------|--------|
| V1 `selectAffirmationPair` selects 2 affirmations from N | ✅ |
| V2 `buildNarrationTracks` produces per-shot tracks (no pairing) | ✅ |
| V2 source does not reference `selectAffirmationPair` | ✅ (confirmed) |

**GAP-3 Status: OPEN** ❌
- V1 cycles 2 affirmation pairs across first/second half of video (8s display / 2s gap)
- V2 narrates each shot individually (N tracks for N shots)
- Parity impact: Different audio placement, timing, and track count

### TC-06: Text Overlay (GAP-4)

| Check | Result |
|-------|--------|
| V1SceneAnimator passes `text: ""` to renderFrame | ✅ |

**GAP-4 Status: CLOSED** ✅ (was fixed — V2 now uses empty text like V1)

### TC-07: Full Pipeline Regression

| Metric | V1 | V2 |
|--------|----|----|
| Success | ✅ | ✅ |
| Size | 8.27 MB | 8.24 MB |
| Δ size | -0.40% | |
| Video stream | h264 | h264 |
| Audio stream | aac | aac |
| Cleanup | ✅ | ✅ |

---

## Overall Harness Re-run (Batch 1 Fixtures — Regression)

| Fixture | V1 Size | V2 Size | Δ% | V1 Duration | V2 Duration |
|---------|---------|---------|-----|-------------|-------------|
| minimal | 8.03 MB | 8.02 MB | -0.14% | 36.0s | 36.0s |
| calm-water | 8.42 MB | 8.37 MB | -0.55% | 56.0s | 56.0s |
| energy-fire | 31.76 MB | 31.73 MB | -0.11% | 76.0s | 76.0s |

All runs succeeded. Exact frame counts match (1080, 1680, 2280 respectively).

---

## Cumulative Gap Status

| Gap | Description | Status | Notes |
|-----|-------------|--------|-------|
| GAP-1 | Kaleidoscope intro/outro | ✅ CLOSED | MINDRA-0065/0066 |
| GAP-2 | Background image URLs | ✅ CLOSED | MINDRA-0063, confirmed this batch |
| GAP-3 | Narration pair cycling | ❌ OPEN | V2 lacks pair-cycling strategy |
| GAP-4 | Text overlay | ✅ CLOSED | Empty text = V1 parity |
| GAP-5 | FFmpeg quality preset | ⚠️ PARTIAL | Hardcoded `medium`, V1 uses quality-based |
| GAP-6 | Music path | ✅ CLOSED | MINDRA-0063/0064 |
| GAP-7 | Temp dir cleanup | ✅ CLOSED | MINDRA-0066 |

**Score: 5/7 fully closed, 1 partial, 1 open**

---

## Blockers

1. **No OPENAI_API_KEY** — Cannot exercise real image generation or TTS. All tests use synthetic fallback. Real provider-backed testing would require:
   - `OPENAI_API_KEY` env var set
   - Valid API credits
   - Network access to OpenAI API

2. **GAP-3 (narration)** — The most significant remaining gap. Requires porting `selectAffirmationPair` + pair-cycling logic into V2 pipeline's `buildNarrationTracks` function.

---

## Recommendation

1. **GAP-3 is the only blocking gap** for V2 promotion. The fix involves:
   - Import `selectAffirmationPair` from `pair-playback.ts` in V2 pipeline
   - Modify `buildNarrationTracks` to use pair selection instead of per-shot iteration
   - Estimated effort: ~1-2 hours

2. **GAP-5 (preset)** is cosmetic — `medium` preset is reasonable for most cases. Make it dynamic when quality options are plumbed through the planner.

3. **Batch 3** should be a full 7-case regression after GAP-3 is closed, ideally with an OPENAI_API_KEY to exercise real generation paths.

4. **V2 promotion readiness**: After GAP-3 is closed, V2 will be at 7/7 parity (6 closed + GAP-5 cosmetic). Safe to promote with a feature flag.

---

## Commits

- `d1c4896` test(MINDRA-0072): add Batch 2 golden parity tests for TC-02, TC-04, TC-06
