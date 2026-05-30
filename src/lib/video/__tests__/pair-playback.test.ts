#!/usr/bin/env npx tsx

import assert from 'assert';
import { generatePairPlaybackManifest, selectAffirmationPair, getActiveAffirmation } from '../pair-playback';

function testSelectsPairRotation() {
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
  assert.deepStrictEqual(result.pair, ['Only', 'Only'], 'single affirmation duplicates for both slots');
}

function testGenerateManifestScenes() {
  const manifest = generatePairPlaybackManifest(
    ['Be strong', 'Stay focused'],
    60, // total duration
    0,  // rotation index
    15, // intro
    15  // outro
  );

  assert.strictEqual(manifest.scenes.length, 2, 'should have 2 scenes');
  assert.strictEqual(manifest.pairIndex, 0);

  // First scene: Affirmation A from intro end to midpoint
  const mid = 15 + (30 / 2); // intro + (main/2) = 15 + 15 = 30
  assert.strictEqual(manifest.scenes[0].affirmation, 'Be strong');
  assert.strictEqual(manifest.scenes[0].startTime, 15);
  assert.strictEqual(manifest.scenes[0].endTime, mid);

  // Second scene: Affirmation B from midpoint to outro start
  assert.strictEqual(manifest.scenes[1].affirmation, 'Stay focused');
  assert.strictEqual(manifest.scenes[1].startTime, mid);
  assert.strictEqual(manifest.scenes[1].endTime, 45); // total - outro = 60 - 15
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
  const manifest = generatePairPlaybackManifest(['A', 'B'], 30, 0, 15, 15);
  assert.strictEqual(manifest.scenes.length, 0, 'no main content → empty scenes');
}

function testGetActiveAffirmation() {
  const manifest = generatePairPlaybackManifest(['A1', 'B1'], 60, 0, 15, 15);

  // During intro (0-15): no affirmation
  assert.strictEqual(getActiveAffirmation(manifest, 0), null);
  assert.strictEqual(getActiveAffirmation(manifest, 14.9), null);

  // First half (15-30): A1
  assert.strictEqual(getActiveAffirmation(manifest, 15), 'A1');
  assert.strictEqual(getActiveAffirmation(manifest, 22), 'A1');

  // Second half (30-45): B1
  assert.strictEqual(getActiveAffirmation(manifest, 30), 'B1');
  assert.strictEqual(getActiveAffirmation(manifest, 40), 'B1');

  // During outro (45-60): no affirmation
  assert.strictEqual(getActiveAffirmation(manifest, 45), null);
  assert.strictEqual(getActiveAffirmation(manifest, 59), null);
}

function main() {
  testSelectsPairRotation();
  testSingleAffirmationEdgeCase();
  testGenerateManifestScenes();
  testEmptyAffirmationsThrows();
  testManifestWithOnlyIntroOutro();
  testGetActiveAffirmation();
  console.log('✅ pair-playback tests passed');
}

main();