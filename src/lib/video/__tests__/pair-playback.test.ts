#!/usr/bin/env npx tsx

import assert from 'assert';
import { generatePairPlaybackManifest, selectAffirmationPair, getActiveAffirmation } from '../pair-playback';

function testLegacyPairSelectorStillWorksForCompatibility() {
  const result = selectAffirmationPair(['A', 'B', 'C', 'D'], 0);
  assert.deepStrictEqual(result.pair, ['A', 'B'], 'pair at index 0 should be first two');
  assert.strictEqual(result.pairIndex, 0);

  const result2 = selectAffirmationPair(['A', 'B', 'C', 'D'], 1);
  assert.deepStrictEqual(result2.pair, ['B', 'C'], 'pair at index 1 should be second and third');

  const result3 = selectAffirmationPair(['A', 'B', 'C', 'D'], 2);
  assert.deepStrictEqual(result3.pair, ['C', 'D'], 'pair at index 2 should be third and fourth');
}

function testSingleAffirmationEdgeCase() {
  const result = selectAffirmationPair(['Only'], 0);
  assert.deepStrictEqual(result.pair, ['Only', 'Only'], 'single affirmation duplicates for legacy pair selector');
}

function testGenerateManifestUsesAllAffirmations() {
  const manifest = generatePairPlaybackManifest(
    ['A1', 'A2', 'A3', 'A4'],
    70, // total duration
    0,  // legacy rotation index ignored for sequencing
    15, // intro
    15  // outro
  );

  assert.strictEqual(manifest.scenes.length, 4, 'should create one scene per affirmation');
  assert.deepStrictEqual(manifest.affirmations, ['A1', 'A2', 'A3', 'A4']);
  assert.strictEqual(manifest.pairIndex, 0, 'legacy field remains stable');

  // Main duration is 40s, so each of 4 affirmations receives 10s.
  assert.deepStrictEqual(
    manifest.scenes.map((scene) => [scene.affirmation, scene.startTime, scene.endTime]),
    [
      ['A1', 15, 25],
      ['A2', 25, 35],
      ['A3', 35, 45],
      ['A4', 45, 55],
    ]
  );
}

function testEmptyAffirmationsThrows() {
  assert.throws(
    () => generatePairPlaybackManifest([], 60, 0, 15, 15),
    /No affirmations available/,
    'empty affirmations should throw'
  );
}

function testManifestWithOnlyIntroOutro() {
  // total duration equals intro+outro, no main content
  const manifest = generatePairPlaybackManifest(['A', 'B', 'C'], 30, 0, 15, 15);
  assert.strictEqual(manifest.scenes.length, 0, 'no main content → empty scenes');
  assert.deepStrictEqual(manifest.affirmations, ['A', 'B', 'C'], 'manifest still preserves all affirmations');
}

function testGetActiveAffirmationUsesFullSequence() {
  const manifest = generatePairPlaybackManifest(['A1', 'B1', 'C1'], 60, 0, 15, 15);

  // During intro (0-15): no affirmation
  assert.strictEqual(getActiveAffirmation(manifest, 0), null);
  assert.strictEqual(getActiveAffirmation(manifest, 14.9), null);

  // Main content 15-45 is split into 3 ten-second affirmation segments.
  assert.strictEqual(getActiveAffirmation(manifest, 15), 'A1');
  assert.strictEqual(getActiveAffirmation(manifest, 24.9), 'A1');
  assert.strictEqual(getActiveAffirmation(manifest, 25), 'B1');
  assert.strictEqual(getActiveAffirmation(manifest, 34.9), 'B1');
  assert.strictEqual(getActiveAffirmation(manifest, 35), 'C1');
  assert.strictEqual(getActiveAffirmation(manifest, 44.9), 'C1');

  // During outro (45-60): no affirmation
  assert.strictEqual(getActiveAffirmation(manifest, 45), null);
  assert.strictEqual(getActiveAffirmation(manifest, 59), null);
}

function main() {
  testLegacyPairSelectorStillWorksForCompatibility();
  testSingleAffirmationEdgeCase();
  testGenerateManifestUsesAllAffirmations();
  testEmptyAffirmationsThrows();
  testManifestWithOnlyIntroOutro();
  testGetActiveAffirmationUsesFullSequence();
  console.log('✅ pair-playback tests passed');
}

main();
