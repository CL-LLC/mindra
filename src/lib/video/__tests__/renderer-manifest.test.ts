#!/usr/bin/env npx tsx

import assert from 'assert';
import { generateAffirmationManifestFromNormalized } from '../renderer';

function testGeneratedManifestDoesNotExposeOverlayText() {
  const manifest = generateAffirmationManifestFromNormalized([
    { affirmation: 'This used to show over the image', duration: 5, title: 'Scene 1' },
    { affirmation: 'This also should not be displayed', duration: 7, title: 'Scene 2' },
  ]);

  assert.strictEqual(manifest.scenes.length, 2);
  assert.deepStrictEqual(
    manifest.scenes.map((scene) => scene.affirmation),
    ['', ''],
    'playback manifest should preserve timing but remove displayed affirmation overlay text'
  );
  assert.deepStrictEqual(
    manifest.scenes.map((scene) => [scene.startTime, scene.endTime]),
    [[0, 5], [5, 12]],
    'removing overlay text should not change affirmation section timing'
  );
  assert.strictEqual(manifest.totalDuration, 12);
}

function main() {
  testGeneratedManifestDoesNotExposeOverlayText();
  console.log('✅ renderer manifest tests passed');
}

main();
