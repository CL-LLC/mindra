#!/usr/bin/env npx tsx
/**
 * V2 Test Harness — MINDRA-0069
 *
 * Internal-only tool to run fixed movies/prompts through both V1 and V2
 * pipelines and compare results (file sizes, durations, structural output).
 *
 * Usage:
 *   MINDRA_PIPELINE_VERSION=2 npx tsx src/lib/video/__tests__/v2-harness.ts
 *   npx tsx src/lib/video/__tests__/v2-harness.ts --v2-only
 *   npx tsx src/lib/video/__tests__/v2-harness.ts --fixture calm-water
 *
 * Flags:
 *   --v2-only        Only run V2 (skip V1 baseline)
 *   --v1-only        Only run V1 (skip V2)
 *   --fixture NAME   Run a specific fixture (default: all)
 *   --json           Machine-readable JSON output
 *   --keep           Keep temp output files (don't cleanup)
 *
 * Environment:
 *   MINDRA_PIPELINE_VERSION  — no effect here; harness explicitly selects pipelines
 *   OPENAI_API_KEY           — required for real image/TTS generation
 *
 * This does NOT change the production default path. V1 remains default.
 * No Convex schema changes. No frontend changes.
 */

import { V1Pipeline } from "../pipeline/v1-pipeline";
import { V2Pipeline } from "../pipeline/v2-pipeline";
import type { RenderPipeline, PipelineResult } from "../pipeline/types";
import type { RenderScene, RenderOptions } from "../render-executor";
import fs from "fs/promises";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Fixtures — fixed scenes for deterministic comparison
// ---------------------------------------------------------------------------

interface HarnessFixture {
  name: string;
  description: string;
  scenes: RenderScene[];
  options?: Partial<RenderOptions>;
}

const FIXTURES: HarnessFixture[] = [
  {
    name: "minimal",
    description: "Single scene, no narration, simplest render",
    scenes: [
      {
        affirmation: "I am at peace",
        duration: 6,
        backgroundColor: "#1a1a2e",
        imagePrompt: "calm ocean at sunset, watercolor style",
      },
    ],
  },
  {
    name: "calm-water",
    description: "3 scenes, moderate durations, varied prompts",
    scenes: [
      {
        affirmation: "Water flows effortlessly around me",
        duration: 8,
        backgroundColor: "#0f3460",
        imagePrompt: "gentle river flowing through a forest, soft light",
      },
      {
        affirmation: "I am calm and centered",
        duration: 10,
        backgroundColor: "#16213e",
        imagePrompt: "still lake reflecting mountains at dawn",
      },
      {
        affirmation: "Peace fills every cell of my body",
        duration: 8,
        backgroundColor: "#1a1a2e",
        imagePrompt: "zen garden with raked sand and smooth stones",
      },
    ],
  },
  {
    name: "energy-fire",
    description: "5 scenes with varied colors and longer durations",
    scenes: [
      {
        affirmation: "I radiate confidence and energy",
        duration: 10,
        backgroundColor: "#e94560",
        imagePrompt: "abstract fire energy burst, vibrant orange and red",
      },
      {
        affirmation: "My potential is limitless",
        duration: 8,
        backgroundColor: "#533483",
        imagePrompt: "galaxy nebula with swirling purple and gold",
      },
      {
        affirmation: "I attract abundance naturally",
        duration: 10,
        backgroundColor: "#0f3460",
        imagePrompt: "golden light streaming through ancient temple pillars",
      },
      {
        affirmation: "Every day I grow stronger",
        duration: 8,
        backgroundColor: "#162447",
        imagePrompt: "mountain peak at golden hour, dramatic sky",
      },
      {
        affirmation: "I am worthy of all good things",
        duration: 10,
        backgroundColor: "#1f4068",
        imagePrompt: "field of sunflowers under clear blue sky",
      },
    ],
    options: {
      quality: "low",
    },
  },
];

// ---------------------------------------------------------------------------
// Harness runner
// ---------------------------------------------------------------------------

interface HarnessRunResult {
  fixture: string;
  version: number;
  success: boolean;
  error?: string;
  fileSizeBytes?: number;
  durationMs?: number;
  meta?: PipelineResult["meta"];
  outputPath?: string;
}

async function runFixture(
  pipeline: RenderPipeline,
  fixture: HarnessFixture,
  outputDir: string,
): Promise<HarnessRunResult> {
  const start = Date.now();
  try {
    const result = await pipeline.render(fixture.scenes, fixture.options);
    const elapsed = Date.now() - start;

    const outputPath = path.join(outputDir, `${fixture.name}-v${pipeline.version}.mp4`);
    await fs.writeFile(outputPath, result.videoBuffer);

    return {
      fixture: fixture.name,
      version: pipeline.version,
      success: true,
      fileSizeBytes: result.videoBuffer.length,
      durationMs: elapsed,
      meta: result.meta,
      outputPath,
    };
  } catch (err: any) {
    return {
      fixture: fixture.name,
      version: pipeline.version,
      success: false,
      error: err.message || String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function compareResults(v1: HarnessRunResult, v2: HarnessRunResult): Promise<string[]> {
  const notes: string[] = [];

  if (!v1.success || !v2.success) {
    if (!v1.success) notes.push(`V1 FAILED: ${v1.error}`);
    if (!v2.success) notes.push(`V2 FAILED: ${v2.error}`);
    return notes;
  }

  const sizeDiff = v2.fileSizeBytes! - v1.fileSizeBytes!;
  const sizePct = ((sizeDiff / v1.fileSizeBytes!) * 100).toFixed(1);
  notes.push(`File size: V1=${(v1.fileSizeBytes! / 1024).toFixed(1)}KB V2=${(v2.fileSizeBytes! / 1024).toFixed(1)}KB (${sizePct}%)`);

  const timeDiff = v2.durationMs! - v1.durationMs!;
  notes.push(`Render time: V1=${v1.durationMs}ms V2=${v2.durationMs}ms (${timeDiff > 0 ? "+" : ""}${timeDiff}ms)`);

  return notes;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const v2Only = args.includes("--v2-only");
  const v1Only = args.includes("--v1-only");
  const jsonOutput = args.includes("--json");
  const keepFiles = args.includes("--keep");
  const fixtureIdx = args.indexOf("--fixture");
  const fixtureArg = args.find((a) => a.startsWith("--fixture="))?.split("=")[1]
    ?? (fixtureIdx >= 0 ? args[fixtureIdx + 1] : undefined);

  const fixtures = fixtureArg
    ? FIXTURES.filter((f) => f.name === fixtureArg)
    : FIXTURES;

  if (fixtures.length === 0) {
    console.error(`Unknown fixture: ${fixtureArg}`);
    console.error(`Available: ${FIXTURES.map((f) => f.name).join(", ")}`);
    process.exit(1);
  }

  const outputDir = path.join(os.tmpdir(), `mindra-harness-${Date.now()}`);
  await fs.mkdir(outputDir, { recursive: true });

  const allResults: HarnessRunResult[] = [];

  for (const fixture of fixtures) {
    if (!jsonOutput) {
      console.log(`\n=== Fixture: ${fixture.name} — ${fixture.description} ===`);
    }

    if (!v2Only) {
      if (!jsonOutput) console.log("  Running V1...");
      const v1Result = await runFixture(new V1Pipeline(), fixture, outputDir);
      allResults.push(v1Result);
      if (!jsonOutput) {
        console.log(`  V1: ${v1Result.success ? "OK" : "FAIL"} ${v1Result.fileSizeBytes ? `(${(v1Result.fileSizeBytes / 1024).toFixed(1)}KB)` : ""} in ${v1Result.durationMs}ms`);
      }
    }

    if (!v1Only) {
      if (!jsonOutput) console.log("  Running V2...");
      const v2Result = await runFixture(new V2Pipeline(), fixture, outputDir);
      allResults.push(v2Result);
      if (!jsonOutput) {
        console.log(`  V2: ${v2Result.success ? "OK" : "FAIL"} ${v2Result.fileSizeBytes ? `(${(v2Result.fileSizeBytes / 1024).toFixed(1)}KB)` : ""} in ${v2Result.durationMs}ms`);
      }
    }

    // Comparison
    if (!v1Only && !v2Only && allResults.length >= 2) {
      const v1r = allResults[allResults.length - 2];
      const v2r = allResults[allResults.length - 1];
      const notes = await compareResults(v1r, v2r);
      if (!jsonOutput) {
        notes.forEach((n) => console.log(`  📊 ${n}`));
      }
    }
  }

  // Cleanup or keep
  if (keepFiles) {
    if (!jsonOutput) console.log(`\n📁 Output files kept at: ${outputDir}`);
  } else {
    await fs.rm(outputDir, { recursive: true, force: true });
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ results: allResults, outputDir: keepFiles ? outputDir : undefined }, null, 2));
  }

  // Exit code: 1 if any run failed
  const failures = allResults.filter((r) => !r.success);
  if (failures.length > 0 && !jsonOutput) {
    console.error(`\n❌ ${failures.length}/${allResults.length} runs failed`);
    process.exit(1);
  }

  if (!jsonOutput) {
    console.log(`\n✅ Harness complete — ${allResults.length} runs, ${failures.length} failures`);
  }
}

main();
