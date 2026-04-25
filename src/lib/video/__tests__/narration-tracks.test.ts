#!/usr/bin/env npx tsx

import assert from "assert";
import { buildNarrationTracks } from "../narration-tracks";

async function testSceneOrderWithMissingAudio() {
  const scenes = [
    { affirmation: "First", durationSec: 4 },
    { affirmation: "Skipped", durationSec: 5 },
    { affirmation: "Third", durationSec: 6 },
  ];

  const tracks = await buildNarrationTracks(scenes, {
    getDurationSec: (scene) => scene.durationSec,
    resolveAudio: async (scene, index) => {
      if (index === 1) return undefined;
      return {
        path: `/tmp/narration-${index}.wav`,
        sourceType: "recorded",
        clipDuration: scene.durationSec,
      };
    },
  });

  assert.ok(tracks, "Expected narration tracks for scenes with audio");
  assert.strictEqual(tracks!.length, 2, "Should create tracks for every scene that has audio");
  assert.strictEqual(tracks![0].start, 0, "First track should start at scene start");
  assert.strictEqual(tracks![1].start, 9, "Third scene should start after prior scene durations even if one scene has no audio");
}

async function testDuplicateAffirmationsRemainDistinct() {
  const scenes = [
    { affirmation: "I am steady", durationSec: 3 },
    { affirmation: "I am steady", durationSec: 7 },
  ];

  const tracks = await buildNarrationTracks(scenes, {
    getDurationSec: (scene) => scene.durationSec,
    resolveAudio: async (_scene, index) => ({
      path: `/tmp/duplicate-${index}.mp3`,
      sourceType: "recorded",
      clipDuration: 2,
    }),
  });

  assert.ok(tracks, "Expected tracks for duplicate affirmations");
  assert.strictEqual(tracks!.length, 2, "Duplicate affirmations should not collapse into one track");
  assert.strictEqual(tracks![0].path, "/tmp/duplicate-0.mp3");
  assert.strictEqual(tracks![1].path, "/tmp/duplicate-1.mp3");
  assert.strictEqual(tracks![1].start, 3, "Second duplicate scene should keep its own start time");
}

async function main() {
  await testSceneOrderWithMissingAudio();
  await testDuplicateAffirmationsRemainDistinct();
  console.log("✅ narration-tracks regression tests passed");
}

main().catch((err) => {
  console.error("❌ narration-tracks regression test failed:", err);
  process.exit(1);
});
