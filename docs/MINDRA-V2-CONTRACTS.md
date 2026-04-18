# Mindra V2 — Internal Contracts & Migration Constraints

> **Status:** Architecture definition for second implementation slice.
> **Branch:** `feat/v2-generator-abstractions`
> **Prerequisite:** First slice (generator seams) already merged.

---

## 1. Guiding Constraints

| Constraint | Rule |
|---|---|
| **Stack** | Same: Next.js, Convex, FFmpeg, Python/PIL, OpenAI. No new runtime deps. |
| **Product flow** | Unchanged. Frontend → Convex → render worker → R2. No schema mutations. |
| **Additive only** | Every new module coexists with V1. No deletions, no renames of V1 paths. |
| **Feature flag** | `MINDRA_V2_PIPELINE` env var (default `false`). Router selects pipeline on this flag. |
| **Rollback** | Setting flag to `false` must restore identical V1 behavior within one deploy. |
| **No frontend / schema changes** | First slice touches only `src/lib/video/**` and `services/render-worker/**`. |

---

## 2. Pipeline Stages

```
Input scenes
    │
    ▼
┌──────────┐
│ Planner  │  decomposes scenes → shot plan
└────┬─────┘
     │
     ▼
┌────────────────┐
│ Keyframe Gen   │  generates still images per shot
└────┬───────────┘
     │
     ▼
┌────────────────┐
│ Scene Animator  │  animates keyframes → video clips
└────┬───────────┘
     │
     ▼
┌──────────┐
│ Assembler │  composites clips + audio + music → final .mp4
└──────────┘
```

Stage order is strict: **image-first → animate-second → assemble-last**.

---

## 3. Interface Definitions

All interfaces live in `src/lib/video/v2/types.ts`.

### 3.1 `ShotPlan`

```ts
export interface ShotPlan {
  sceneIndex: number;
  shotId: string;                  // unique within render job
  affirmation: string;
  durationSec: number;
  imagePrompt: string;
  backgroundColor: string;
  language?: string;
  // metadata only — not used by downstream stages
  title?: string;
  description?: string;
}

export interface RenderPlan {
  shots: ShotPlan[];
  globalOptions: {
    width: number;
    height: number;
    fps: number;
    musicTrack?: string;
    kaleidoscope?: KaleidoscopeConfig;
  };
}
```

### 3.2 `Planner`

```ts
export interface Planner {
  plan(scenes: RenderScene[], options: RenderOptions): Promise<RenderPlan>;
}
```

**Migration note:** The V1 planner is trivial — one shot per scene, prompt = `scene.imagePrompt`. V2 can decompose scenes into multiple shots, add transitions, etc. The V1 planner is the identity-like mapping.

### 3.3 `KeyframeGenerator`

```ts
export interface KeyframeGenerator {
  generate(shot: ShotPlan, tempDir: string, index: number): Promise<KeyframeResult>;
}

export interface KeyframeResult {
  imagePath: string;
  width: number;
  height: number;
}
```

**Migration note:** Wraps existing `ImageGenerator.generate()`. The key difference is the output type is explicit (`KeyframeResult`) instead of `string | undefined`.

### 3.4 `SceneAnimator`

```ts
export interface SceneAnimator {
  animate(params: AnimateParams): Promise<AnimateResult>;
}

export interface AnimateParams {
  keyframe: KeyframeResult;
  shot: ShotPlan;
  tempDir: string;
  index: number;
  fps: number;
}

export interface AnimateResult {
  clipPath: string;
  durationSec: number;
}
```

**Migration note:** V1 implementation delegates to `SceneRenderer.renderFrame()` + FFmpeg still-image-to-video (the existing PIL + concat flow). Future implementations can use Runway, Kling, etc.

### 3.5 `Assembler`

```ts
export interface Assembler {
  assemble(params: AssembleParams): Promise<Buffer>;
}

export interface AssembleParams {
  clips: AnimateResult[];
  narrationTracks: NarrationTrack[];
  musicAsset: MusicAssetConfig;
  musicPath: string;
  tempDir: string;
  totalDurationSec: number;
  introPath?: string;
  outroPath?: string;
  globalOptions: RenderPlan['globalOptions'];
}

export interface MusicAssetConfig {
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trackId: string;
}
```

**Migration note:** Wraps existing `VideoComposer.concatScenes()` + `mixAudio()`. V1 assembler is a thin adapter.

### 3.6 `JobRouter`

```ts
export interface JobRouter {
  selectPipeline(options: RenderOptions): 'v1' | 'v2';
}
```

**Default implementation:**

```ts
export class EnvJobRouter implements JobRouter {
  selectPipeline(options: RenderOptions): 'v1' | 'v2' {
    return process.env.MINDRA_V2_PIPELINE === 'true' ? 'v2' : 'v1';
  }
}
```

---

## 4. File Layout

```
src/lib/video/
  v2/
    types.ts              # interfaces above
    planner.ts            # V1Planner (identity mapping)
    keyframe-generator.ts # V1KeyframeGenerator (wraps OpenAI image gen)
    scene-animator.ts     # V1SceneAnimator (wraps PIL + ffmpeg)
    assembler.ts          # V1Assembler (wraps concat + audio mix)
    job-router.ts         # EnvJobRouter
    pipeline.ts           # orchestrates the 4 stages
  generators/             # first-slice seams (unchanged)
  render-executor.ts      # existing entry point (unchanged in slice 2)
```

`pipeline.ts` is the new orchestration entry. It replaces the inline logic in `render-executor.ts` but `render-executor.ts` continues to call its existing path when the router returns `'v1'`.

---

## 5. Migration Constraints

| Area | Constraint |
|---|---|
| `render-executor.ts` | Not modified. A new `render-v2.ts` or conditional branch in `render-executor.ts` selects pipeline via `JobRouter`. |
| `generators/` | First-slice seams remain the backing implementations. V2 adapters delegate to them. |
| Convex schema | Zero changes. `renderWebhook.ts`, `mindMovies.ts` untouched. |
| Frontend | Zero changes. API contract (`/api/render`) unchanged. |
| Python subprocess | Same invocation, same args. `SceneAnimator` V1 calls same PIL script. |
| FFmpeg | Same commands. `Assembler` V1 calls same concat/mix. |
| Env vars | Only `MINDRA_V2_PIPELINE` added. All existing vars unchanged. |

---

## 6. First Slice 2 Scope

The second implementation slice creates exactly these files:

1. `src/lib/video/v2/types.ts` — all interfaces from §3
2. `src/lib/video/v2/planner.ts` — `V1Planner` (one shot per scene)
3. `src/lib/video/v2/keyframe-generator.ts` — `V1KeyframeGenerator` (delegates to existing `ImageGenerator`)
4. `src/lib/video/v2/scene-animator.ts` — `V1SceneAnimator` (delegates to existing `SceneRenderer` + ffmpeg still-to-video)
5. `src/lib/video/v2/assembler.ts` — `V1Assembler` (delegates to existing `VideoComposer`)
6. `src/lib/video/v2/job-router.ts` — `EnvJobRouter`
7. `src/lib/video/v2/pipeline.ts` — orchestrates the 4 stages, returns `Buffer`

**Verification:** With `MINDRA_V2_PIPELINE=true`, output must be byte-identical (within codec variance) to V1 output. No new behavior, just new plumbing.

**No changes to:** `render-executor.ts`, any file outside `src/lib/video/`, Convex, frontend, or Python scripts.

---

## 8. Slice 2 Implementation Status (2026-04-18)

All 8 files created and compiling cleanly:

| File | Status |
|---|---|
| `src/lib/video/v2/types.ts` | ✅ All interfaces from §3 |
| `src/lib/video/v2/planner.ts` | ✅ `V1Planner` (identity mapping) |
| `src/lib/video/v2/keyframe-generator.ts` | ✅ `V1KeyframeGenerator` (delegates to `ImageGenerator`) |
| `src/lib/video/v2/scene-animator.ts` | ✅ `V1SceneAnimator` (PIL + ffmpeg still-to-video) |
| `src/lib/video/v2/assembler.ts` | ✅ `V1Assembler` (delegates to `VideoComposer`) |
| `src/lib/video/v2/job-router.ts` | ✅ `EnvJobRouter` (env-var based) |
| `src/lib/video/v2/pipeline.ts` | ✅ Orchestrates 4 stages sequentially |
| `src/lib/video/v2/index.ts` | ✅ Barrel export |

### Integration Seam (for Builder)

To wire V2 into the existing render path, the Builder needs to:

1. **Add a conditional branch** in `render-executor.ts` (or a new `render-v2-bridge.ts`):
   ```ts
   import { EnvJobRouter } from './v2';
   const router = new EnvJobRouter();
   if (router.selectPipeline(options) === 'v2') {
     return runV2Pipeline(scenes, options, { planner, keyframeGenerator, sceneAnimator, assembler, buildNarrationTracks });
   }
   // ... existing V1 path ...
   ```

2. **Wire dependencies** — pass the existing `generators` object to V1 adapter constructors:
   ```ts
   const planner = new V1Planner();
   const kfGen = new V1KeyframeGenerator(generators.imageGenerator, width, height);
   const animator = new V1SceneAnimator(generators.sceneRenderer, shellQuote);
   const assembler = new V1Assembler(generators.videoComposer, shellQuote);
   ```

3. **Handle music/kaleidoscope resolution** — the existing `getMusicAsset()` + `resolveMusicAssetPath()` calls stay in the integration layer. Pass resolved paths to `assembler.assemble()`.

4. **`buildNarrationTracks` callback** — extract the existing narration track building logic (data-url → file, TTS → file) into a function matching the `V2PipelineDeps.buildNarrationTracks` signature.

**Key invariant:** With `MINDRA_V2_PIPELINE=true`, the V2 path must produce output identical to V1 (same frames, same audio mix, same codec settings). The adapters are thin wrappers — no behavioral divergence.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Output divergence between V1 inline path and V2 adapter path | Bit-accurate comparison test on a fixed scene set. |
| `render-executor.ts` coupling to globals (openai client, python path) | V2 pipeline receives these via explicit params, not module-level globals. |
| Kaleidoscope intro/outro logic is interleaved in executor | Planner includes intro/outro shots in the plan; assembler handles ordering. |
| Pair-playback logic (dual affirmation per scene) | Planner emits two shots per scene when pair-playback is active. |

---

## 8. Recommended Next Slice

After slice 2 lands, the natural next step is **provider swap**: replace `V1KeyframeGenerator` with an alternative image provider (e.g., Flux via Replicate, or DALL-E 3 HD) behind the same interface, testable by flipping a second env var. This validates the whole point of the abstraction.
