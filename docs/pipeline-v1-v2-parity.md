# Pipeline V1 vs V2 Parity Validation — MINDRA-0062

**Date:** 2026-04-18
**Branch:** `feat/v2-generator-abstractions`
**Status:** Parity gaps documented, V2 not yet production-ready

## Summary

V2 pipeline (`V2Pipeline` + `runV2Pipeline`) reorganizes V1's `RenderContext` into a staged architecture (Planner → KeyframeGen → Animate → Assemble). The V1 adapters (`V1Planner`, `V1KeyframeGenerator`, `V1SceneAnimator`, `V1Assembler`) delegate to existing generator seams. However, several behavioral differences exist that would cause divergent output.

## Structural Comparison

| Stage | V1 (RenderContext) | V2 (runV2Pipeline + adapters) |
|-------|-------------------|-------------------------------|
| Plan | Inline in `renderScenes()` | `V1Planner.plan()` — identity map |
| Image gen | `ensureSceneImageAsset()` (bg URL first, then gen) | `V1KeyframeGenerator.generate()` (gen only) |
| Frame render | `generators.sceneRenderer.renderFrame()` with `text: ""` | `V1SceneAnimator.animate()` with `text: shot.affirmation` |
| Still→video | ffmpeg with quality-based preset | ffmpeg without preset |
| Kaleidoscope | Intro/outro resolved and rendered in `renderScenes()` | Not handled — `AssembleParams` has optional fields but V2Pipeline never populates them |
| Narration | `buildSceneNarrationTracks()` (affirmation-pair cycling) | `buildNarrationTracks()` in v2-pipeline.ts (per-shot, no pair cycling) |
| Music | Resolved in `prepare()`, passed to `mixAudio` | Resolved in `V2Pipeline.render()` but never passed to `runV2Pipeline` |
| Font size | `Math.floor(height * 0.06)` | Hardcoded `48` |
| Default bgColor | `getRandomGradientColor()` (purple palette) | `'#000000'` |
| Cleanup | `try/finally` with `cleanup()` | No cleanup in `runV2Pipeline` (temp dir leaked) |
| Temp dir prefix | `mindra-render-` | `mindra-v2-` |

## Parity Gaps (MUST fix before V2 can be default)

### GAP-1: Kaleidoscope intro/outro missing
- **V1:** Resolves stock/synthetic kaleidoscope clips, prepends/appends to concat
- **V2:** `runV2Pipeline` has `introPath`/`outroPath` in `AssembleParams` but `V2Pipeline.render()` never resolves or passes them
- **Impact:** V2 videos have no intro/outro clips
- **Fix:** Add kaleidoscope resolution in `V2Pipeline.render()` or a dedicated stage

### GAP-2: Background image URL not resolved
- **V1:** `ensureSceneImageAsset()` calls `resolveBackgroundImage(scene.backgroundImageUrl, ...)` before falling back to AI image gen
- **V2:** `V1KeyframeGenerator.generate()` only calls `imageGenerator.generate()` — ignores `backgroundImageUrl`
- **Impact:** Scenes with `backgroundImageUrl` produce different images in V2

### GAP-3: Narration track strategy differs
- **V1:** Uses `selectAffirmationPair()` → cycles two tracks across first/second half of video with 8s display / 2s gap pattern
- **V2:** `buildNarrationTracks()` in v2-pipeline.ts iterates each shot individually, no pairing or cycling
- **Impact:** V2 narration audio placement is completely different

### GAP-4: Scene text rendered on frames
- **V1:** `renderFrame(text: "")` — no text on video frames (text is only in image prompts)
- **V2:** `renderFrame(text: shot.affirmation)` — affirmation text overlaid on each frame
- **Impact:** V2 videos show text overlay; V1 videos do not

### GAP-5: FFmpeg quality preset not applied
- **V1:** Uses quality-based preset (slow/medium/ultrafast) for encoding
- **V2:** No `-preset` flag in ffmpeg command
- **Impact:** V2 encoding uses default preset (medium), file size/quality may differ

### GAP-6: Music path not passed through
- **V1:** `musicPath` resolved in prepare, passed to `mixAudio`
- **V2:** `V2Pipeline.render()` resolves `rawMusicPath` but `runV2Pipeline` receives hardcoded empty string
- **Impact:** V2 videos have no background music

### GAP-7: Temp directory cleanup missing
- **V1:** `try/finally { cleanup() }` ensures temp dir removal
- **V2:** `runV2Pipeline` creates temp dir but never cleans it up
- **Impact:** Temp file leak on every V2 render

## Minor Differences (cosmetic, non-blocking)

| Item | V1 | V2 |
|------|----|----|
| Font size | Dynamic: `floor(height * 0.06)` | Hardcoded: `48` |
| Default bgColor | Random purple gradient | `#000000` (black) |
| Temp dir prefix | `mindra-render-` | `mindra-v2-` |
| FFmpeg maxBuffer | `50 * 1024 * 1024` | Not set (default) |

## Validation Approach

A structural parity test (`src/lib/video/__tests__/pipeline-parity.test.ts`) exercises both V1 and V2 paths with mocked generators to verify:
1. Both pipelines call the same generator methods with equivalent parameters
2. Both produce the same number of clips
3. Assembly receives equivalent concat/audio inputs

**Note:** This test cannot run without a test framework (no jest/vitest configured). The test is written for future execution.

## Conclusion

V2 pipeline architecture is sound but has **7 parity gaps** that would produce visibly different output from V1. The gaps are addressable by:
1. Adding kaleidoscope stage to V2Pipeline
2. Adding `resolveBackgroundImage` call in V1KeyframeGenerator
3. Porting the affirmation-pair narration strategy to V2
4. Fixing text overlay to match V1 (empty string)
5. Adding quality preset to V2SceneAnimator's ffmpeg command
6. Passing resolved music path through to assembler
7. Adding temp dir cleanup in runV2Pipeline

## Next Safe Action

Address GAP-4, GAP-5, GAP-7 first (lowest risk, no new dependencies):
- GAP-4: Change `text: shot.affirmation` → `text: ""` in `V1SceneAnimator`
- GAP-5: Add `-preset` based on quality option to V2SceneAnimator
- GAP-7: Add `try/finally` cleanup in `runV2Pipeline`

Then tackle GAP-1, GAP-2, GAP-6 (require plumbing config through stages).
GAP-3 (narration) is the most complex and should be last.
