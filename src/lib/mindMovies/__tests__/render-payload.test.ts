#!/usr/bin/env npx tsx

import assert from 'assert';
import { buildScenesForRender, EmotionalImageMeta } from '../render-payload';

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

function testEmotionalImagesMappedToScenesProportionally() {
  const emotionalImages: EmotionalImageMeta[] = [
    { storageId: 's1', imageUrl: 'https://example.com/img1.jpg', goalIndex: 0, usageMode: 'direct' },
    { storageId: 's2', imageUrl: 'https://example.com/img2.jpg', goalIndex: 1, usageMode: 'direct' },
  ];

  const scenes = buildScenesForRender({
    storyboard: storyboard(4),
    affirmations: ['A1', 'A2'],
    emotionalImages,
  });

  assert.strictEqual(scenes.length, 4);

  // 2 images distributed across 4 scenes proportionally
  // Index 0,1 -> first image (img1), Index 2,3 -> second image (img2)
  assert.strictEqual(scenes[0].backgroundImageUrl, 'https://example.com/img1.jpg', 'scene 0 should get first emotional image');
  assert.strictEqual(scenes[1].backgroundImageUrl, 'https://example.com/img1.jpg', 'scene 1 should get first emotional image');
  assert.strictEqual(scenes[2].backgroundImageUrl, 'https://example.com/img2.jpg', 'scene 2 should get second emotional image');
  assert.strictEqual(scenes[3].backgroundImageUrl, 'https://example.com/img2.jpg', 'scene 3 should get second emotional image');

  // Original storyboard imageUrl should be overridden
  assert.notStrictEqual(scenes[0].backgroundImageUrl, scenes[0].imagePrompt);
}

function testExactSceneIndexTakesPriority() {
  const emotionalImages: EmotionalImageMeta[] = [
    { storageId: 's1', imageUrl: 'https://example.com/proportional.jpg', goalIndex: 0, usageMode: 'direct' },
    { storageId: 's2', imageUrl: 'https://example.com/exact-scene-3.jpg', sceneIndex: 3, usageMode: 'direct' },
  ];

  const scenes = buildScenesForRender({
    storyboard: storyboard(6),
    affirmations: ['A1'],
    emotionalImages,
  });

  // Scene 3 should get the exact match, others use proportional images only
  assert.strictEqual(scenes[3].backgroundImageUrl, 'https://example.com/exact-scene-3.jpg', 'scene 3 should get exact sceneIndex match');
  assert.strictEqual(scenes[0].backgroundImageUrl, 'https://example.com/proportional.jpg', 'scene 0 should get proportional image');
  assert.strictEqual(scenes[5].backgroundImageUrl, 'https://example.com/proportional.jpg', 'scene 5 should not reuse exact scene images through proportional fallback');
}

function testEmotionalImagesWithBothMode() {
  const emotionalImages: EmotionalImageMeta[] = [
    { storageId: 's1', imageUrl: 'https://example.com/img-both.jpg', goalIndex: 0, usageMode: 'both' },
  ];

  const scenes = buildScenesForRender({
    storyboard: storyboard(3),
    affirmations: ['A1'],
    emotionalImages,
  });

  // 'both' mode should also map to backgroundImageUrl
  assert.strictEqual(scenes[0].backgroundImageUrl, 'https://example.com/img-both.jpg', 'both mode images should map to backgroundImageUrl');
  assert.strictEqual(scenes[2].backgroundImageUrl, 'https://example.com/img-both.jpg', 'both mode distributes across scenes');
}

function testStyleReferenceOnlyImagesDoNotMapToBackground() {
  const emotionalImages: EmotionalImageMeta[] = [
    { storageId: 's1', imageUrl: 'https://example.com/style-only.jpg', goalIndex: 0, usageMode: 'style_reference' },
  ];

  const scenes = buildScenesForRender({
    storyboard: storyboard(4),
    affirmations: ['A1'],
    emotionalImages,
  });

  // style_reference images should NOT appear as backgroundImageUrl
  for (const scene of scenes) {
    assert.strictEqual(scene.backgroundImageUrl, undefined,
      'style_reference-only images must not appear in backgroundImageUrl');
  }
}

function testEmptyEmotionalImagesPreservesExistingBehavior() {
  const scenes = buildScenesForRender({
    storyboard: storyboard(3),
    affirmations: ['A1', 'A2'],
  });

  assert.strictEqual(scenes.length, 3);
  assert.strictEqual(scenes[0].backgroundImageUrl, undefined, 'no emotional images = no backgroundImageUrl');
  assert.strictEqual(scenes[0].affirmation, 'A1');
}

function main() {
  testTwoRecordedAffirmationsAreSplitAcrossMovie();
  testSceneDescriptionsDoNotBecomeAffirmationNarrationWhenAffirmationsExist();
  testEmotionalImagesMappedToScenesProportionally();
  testExactSceneIndexTakesPriority();
  testEmotionalImagesWithBothMode();
  testStyleReferenceOnlyImagesDoNotMapToBackground();
  testEmptyEmotionalImagesPreservesExistingBehavior();
  console.log('✅ render-payload tests passed');
}

main();