# Mindra V2 Architecture

## Decision
Mindra V2 will be introduced as a **feature-flagged, additive pipeline**.

The current V1 render flow remains the production default while V2 is built behind a flag and compared safely.

Core principle:

**image-first -> animate-second -> assemble-last**

## Migration rule
- V1 remains the default path until V2 is validated.
- V2 is additive only.
- No production cutover without explicit validation.
- Rollback must be immediate by disabling the V2 flag.

## First V2 seams
The first implementation slice introduces pluggable generator seams around the existing renderer:

- `ImageGenerator`
- `SceneRenderer`
- `AudioGenerator`
- `VideoComposer`

These seams are currently backed by the existing production logic:
- OpenAI image generation
- Python/PIL frame rendering
- OpenAI TTS
- FFmpeg composition/audio mixing

## Current module boundaries
Initial scaffold lives under:

- `src/lib/video/generators/types.ts`
- `src/lib/video/generators/index.ts`
- `src/lib/video/generators/openai-image.ts`
- `src/lib/video/generators/openai-tts.ts`
- `src/lib/video/generators/pil-scene-renderer.ts`
- `src/lib/video/generators/ffmpeg-composer.ts`

The existing `src/lib/video/render-executor.ts` remains the orchestration entry point, now delegating key media operations through generator adapters.

## Next V2 contracts
Next architectural contracts to formalize after the first scaffold slice:

- `ScenePlanner`
- `KeyframeGenerator`
- `SceneAnimator`
- `Assembler`
- `JobRouter`

These will support provider routing, scene-level retries, and future backends without rewriting the product workflow.

## Risks to manage
- `render-executor.ts` is still a high-coupling file and must be reduced incrementally.
- FFmpeg audio mixing is sensitive and must preserve existing output behavior.
- Python subprocess quoting/argument handling must remain exact.
- Test coverage is thin, so each extraction step needs targeted verification.

## Immediate implementation goal
The current slice is not a backend migration. It is internal plumbing that makes backend migration possible.

Definition of success for this slice:
- existing render behavior remains stable
- generator seams exist and are real, not speculative
- V2 can evolve without another monolithic rewrite
