#!/usr/bin/env npx tsx

import assert from 'assert';
import { buildScenesForRender } from '../render-payload';

const tinyAudio = (label: string) => `data:audio/wav;base64,${Buffer.from(label).toString('base64')}`;

function storyboard(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Scene ${index + 1}`,
    description: `Scene description ${index + 1}`,
    affirmation: `Scene fallback ${index + 1}`,
    duration: 6,
    imagePrompt: `Image prompt ${index + 1}`,
  }));
}

function testTwoRecordedAffirmationsAreSplitAcrossMovie() {
  const scenes = buildScenesForRender({
    storyboard: storyboard(8),
    affirmations: ['I am calm and strong', 'I create prosperity with ease'],
    voiceRecordings: [
      { affirmationIndex: 0, audioDataUrl: tinyAudio('recording-one'), mimeType: 'audio/wav', durationMs: 2000 },
      { affirmationIndex: 1, audioDataUrl: tinyAudio('recording-two'), mimeType: 'audio/wav', durationMs: 2500 },
    ],
    language: 'en',
  });

  assert.strictEqual(scenes.length, 8);
  for (const [index, scene] of scenes.entries()) {
    const expectedFirstHalf = index < 4;
    assert.strictEqual(
      scene.affirmation,
      expectedFirstHalf ? 'I am calm and strong' : 'I create prosperity with ease',
      `scene ${index} should use the proportional affirmation text, not scene description`
    );
    assert.strictEqual(
      scene.narrationAudioDataUrl,
      expectedFirstHalf ? tinyAudio('recording-one') : tinyAudio('recording-two'),
      `scene ${index} should use the matching user recording`
    );
    assert.strictEqual(
      scene.narrationMimeType,
      'audio/wav',
      `scene ${index} should preserve recorded mime type`
    );
  }
}

function testSceneDescriptionsDoNotBecomeAffirmationNarrationWhenAffirmationsExist() {
  const scenes = buildScenesForRender({
    storyboard: storyboard(5),
    affirmations: ['First user affirmation', 'Second user affirmation'],
    voiceRecordings: [
      { affirmationIndex: 0, audioDataUrl: tinyAudio('first'), mimeType: 'audio/wav' },
      { affirmationIndex: 1, audioDataUrl: tinyAudio('second'), mimeType: 'audio/wav' },
    ],
  });

  assert.deepStrictEqual(
    scenes.map((scene) => scene.affirmation),
    [
      'First user affirmation',
      'First user affirmation',
      'First user affirmation',
      'Second user affirmation',
      'Second user affirmation',
    ],
    'affirmation text should be distributed from user affirmations, never storyboard descriptions'
  );
  assert.ok(
    scenes.every((scene) => !scene.affirmation.startsWith('Scene description')),
    'scene descriptions must not become spoken affirmation text'
  );
}

function main() {
  testTwoRecordedAffirmationsAreSplitAcrossMovie();
  testSceneDescriptionsDoNotBecomeAffirmationNarrationWhenAffirmationsExist();
  console.log('✅ render-payload tests passed');
}

main();
