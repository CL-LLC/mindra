# MINDRA-0070: Golden Render Evaluation Pack — V1 vs V2

**Date:** 2026-04-18
**Branch:** `feat/v2-generator-abstractions`
**Status:** Defined, ready for first test batch

---

## Purpose

Fixed prompt/movie cases for automated and manual V1 vs V2 output comparison. Each case targets specific parity gaps from `pipeline-v1-v2-parity.md`. No product or schema changes — evaluation only.

---

## Test Cases (7)

### TC-01: Minimal single-scene, no background URL
```json
{
  "id": "tc-01-minimal",
  "title": "Single Scene Minimal",
  "scenes": [
    {
      "prompt": "A calm ocean at sunrise with golden light reflecting on water",
      "affirmation": "I am at peace with the flow of life",
      "duration": 8,
      "backgroundImageUrl": null,
      "bgColor": "#1a0533"
    }
  ],
  "targetGaps": [],
  "notes": "Baseline — both pipelines should produce nearly identical output"
}
```

### TC-02: Multi-scene with background URLs
```json
{
  "id": "tc-02-bgurl",
  "title": "Multi-Scene Background URLs",
  "scenes": [
    {
      "prompt": "Lush green forest with sunlight filtering through canopy",
      "affirmation": "I am grounded and connected to nature",
      "duration": 6,
      "backgroundImageUrl": "https://example.test/forest.jpg",
      "bgColor": "#0a2e1a"
    },
    {
      "prompt": "Mountain peak above clouds at golden hour",
      "affirmation": "I rise above challenges with ease",
      "duration": 6,
      "backgroundImageUrl": "https://example.test/mountain.jpg",
      "bgColor": "#2a1a0a"
    },
    {
      "prompt": "Starry night sky over a still lake",
      "affirmation": "I am infinite potential",
      "duration": 8,
      "backgroundImageUrl": null,
      "bgColor": "#050520"
    }
  ],
  "targetGaps": ["GAP-2"],
  "notes": "V1 should use bg URLs; V2 should differ (GAP-2)"
}
```

### TC-03: Kaleidoscope intro/outro
```json
{
  "id": "tc-03-kaleidoscope",
  "title": "Kaleidoscope Intro Outro",
  "scenes": [
    {
      "prompt": "Abstract fractal patterns in deep purple and gold",
      "affirmation": "I embrace the beauty of transformation",
      "duration": 6,
      "backgroundImageUrl": null,
      "bgColor": "#2d1054"
    }
  ],
  "kaleidoscope": { "enabled": true },
  "targetGaps": ["GAP-1"],
  "notes": "V1 produces intro+outro clips; V2 omits them (GAP-1)"
}
```

### TC-04: Narration affirmation cycling
```json
{
  "id": "tc-04-narration",
  "title": "Narration Pair Cycling",
  "scenes": [
    { "prompt": "Gentle rain on a tin roof", "affirmation": "I welcome cleansing change", "duration": 8 },
    { "prompt": "A butterfly emerging from cocoon", "affirmation": "I am becoming who I truly am", "duration": 8 },
    { "prompt": "Waves crashing on volcanic rock", "affirmation": "I am strong and resilient", "duration": 8 },
    { "prompt": "Cherry blossoms falling in slow motion", "affirmation": "I release what no longer serves me", "duration": 8 }
  ],
  "narration": { "enabled": true },
  "targetGaps": ["GAP-3"],
  "notes": "V1 cycles affirmation pairs; V2 narrates each shot independently (GAP-3)"
}
```

### TC-05: Background music
```json
{
  "id": "tc-05-music",
  "title": "Background Music Present",
  "scenes": [
    {
      "prompt": "A cozy cabin with a fireplace in winter",
      "affirmation": "I am safe and warm",
      "duration": 10,
      "backgroundImageUrl": null,
      "bgColor": "#1a0a0a"
    }
  ],
  "music": { "enabled": true, "track": "ambient-calm" },
  "targetGaps": ["GAP-6"],
  "notes": "V1 includes music; V2 silent (GAP-6)"
}
```

### TC-06: Text overlay check
```json
{
  "id": "tc-06-text-overlay",
  "title": "Frame Text Overlay",
  "scenes": [
    {
      "prompt": "A winding path through a misty meadow",
      "affirmation": "I trust the journey ahead",
      "duration": 8,
      "backgroundImageUrl": null,
      "bgColor": "#1a2a1a"
    }
  ],
  "targetGaps": ["GAP-4"],
  "notes": "V1 renders frames with text=''; V2 overlays affirmation (GAP-4)"
}
```

### TC-07: Full pipeline stress
```json
{
  "id": "tc-07-full",
  "title": "Full Pipeline Parity",
  "scenes": [
    { "prompt": "Aurora borealis over snowy tundra", "affirmation": "I am aligned with cosmic energy", "duration": 6 },
    { "prompt": "Desert dunes at blue hour", "affirmation": "I find beauty in vast emptiness", "duration": 6 },
    { "prompt": "Underwater coral reef teeming with life", "affirmation": "I am connected to all living things", "duration": 6 },
    { "prompt": "Ancient temple covered in moss", "affirmation": "I honor wisdom of the ages", "duration": 6 },
    { "prompt": "A single tree on a hilltop at sunset", "affirmation": "I stand strong in my truth", "duration": 8 }
  ],
  "kaleidoscope": { "enabled": true },
  "music": { "enabled": true, "track": "ambient-uplifting" },
  "narration": { "enabled": true },
  "targetGaps": ["GAP-1", "GAP-2", "GAP-3", "GAP-4", "GAP-5", "GAP-6", "GAP-7"],
  "notes": "Exercises every known parity gap; comprehensive comparison"
}
```

---

## Scoring Criteria

Each test case is scored across these dimensions (0–3 scale):

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Visual fidelity** | Completely different images | Similar subject, wrong style | Close match | Pixel-near-identical |
| **Audio parity** | Missing audio track | Wrong timing/level | Correct track, minor timing drift | Identical audio |
| **Duration accuracy** | Off by >2s | Off by 1–2s | Off by <1s | Exact match |
| **Structural parity** | Missing clips or segments | Wrong clip order | Correct clips, minor boundary diff | Identical structure |
| **Cleanup** | Temp dir leaked | — | — | Cleaned up |

**Parity score** = sum of dimensions / (3 × dimension_count). Target: ≥ 0.85 for V2 promotion.

---

## Comparison Method

1. **Render both** V1 and V2 with identical seed/rng state for each test case
2. **Automated checks** (CI):
   - Probe `ffprobe` duration, stream count, codec params
   - Structural: verify clip count, intro/outro presence, audio streams
   - File hash comparison for deterministic outputs (e.g., ffmpeg concat)
3. **Visual spot-check** (manual, first batch only):
   - Side-by-side playback at 1× speed
   - Screenshot frame at 25%, 50%, 75% marks — overlay diff
4. **Audio spot-check** (manual):
   - Waveform overlay in Audacity or equivalent
   - A/B listening for music + narration placement
5. **Gap mapping**: Record which GAP-* items each case surfaces; cross-reference with parity doc

---

## Recommended First Test Batch

**Batch 1** (covers all 7 known gaps with 4 cases):

| Priority | Case | Why |
|----------|------|-----|
| 1 | TC-01 | Baseline sanity — must pass before others matter |
| 2 | TC-07 | Full pipeline — surfaces all gaps at once |
| 3 | TC-03 | Kaleidoscope — biggest visible difference (GAP-1) |
| 4 | TC-05 | Music — silent V2 output is immediately obvious (GAP-6) |

Run these four first. If TC-01 fails, stop and debug V2 fundamentals. If TC-07 surfaces >3 gaps at score <0.5, V2 is not ready for further case-by-case testing.

**Next batches** after gaps are patched:
- Batch 2: TC-02, TC-04, TC-06 (targeted gap verification)
- Batch 3: All 7 cases re-run (regression check)

---

## File Reference

- Parity gaps: `docs/pipeline-v1-v2-parity.md`
- V2 pipeline: `src/lib/video/v2-pipeline.ts`
- V1 render context: `src/lib/video/render-context.ts`
- Parity test: `src/lib/video/__tests__/pipeline-parity.test.ts`
