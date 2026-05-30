#!/usr/bin/env npx tsx

import assert from 'assert';
import { buildMindMovieScenePlan } from '../scene-plan';
import { buildScenesForRender, EmotionalImageMeta } from '../render-payload';

function storyboard(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Scene ${index + 1}`,
    description: `Scene description ${index + 1}`,
    affirmation: `Fallback ${index + 1}`,
    duration: 6,
    imagePrompt: `Image prompt ${index + 1}`,
  }));
}

function image(goalIndex: number, url: string): EmotionalImageMeta {
  return { storageId: `s${goalIndex}`, imageUrl: url, goalIndex, usageMode: 'both' };
}

function testUploadedImagesArePreferredWithoutReplacingFlux() {
  const uploadedImages = [0, 1, 2, 3, 4].map((i) => image(i, `https://example.com/${i}.jpg`));
  const plan = buildMindMovieScenePlan({
    storyboard: storyboard(12),
    affirmations: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
    emotionalImages: uploadedImages,
  });

  const uploadedScenes = plan.filter((scene) => scene.visualSource === 'uploaded_direct');
  const fluxScenes = plan.filter((scene) => scene.visualSource === 'flux_generated');
  const usedUrls = new Set(uploadedScenes.map((scene) => scene.backgroundImageUrl));

  assert.strictEqual(plan.length, 12);
  assert.strictEqual(uploadedScenes.length, uploadedImages.length, 'every uploaded image should be shown when scene count allows');
  assert.deepStrictEqual(usedUrls, new Set(uploadedImages.map((image) => image.imageUrl)), 'all uploaded image URLs should appear in the plan');
  assert.ok(fluxScenes.length > 0, 'FLUX should remain active alongside uploaded images');
}

function testTooManyUploadedImagesAreCappedToPreserveFlux() {
  const plan = buildMindMovieScenePlan({
    storyboard: storyboard(12),
    affirmations: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    emotionalImages: Array.from({ length: 11 }, (_, i) => image(i, `https://example.com/many-${i}.jpg`)),
  });

  const uploadedScenes = plan.filter((scene) => scene.visualSource === 'uploaded_direct');
  const fluxScenes = plan.filter((scene) => scene.visualSource === 'flux_generated');

  assert.strictEqual(uploadedScenes.length, 9, 'planner should reserve roughly 25% of scenes for FLUX when uploads exceed available anchor slots');
  assert.strictEqual(fluxScenes.length, 3, '12-scene movie should preserve 3 FLUX scenes when possible');
}

function testEveryAffirmationIsRepresentedWhenSceneCountAllowsIt() {
  const plan = buildMindMovieScenePlan({
    storyboard: storyboard(10),
    affirmations: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    emotionalImages: [],
  });

  const used = new Set(plan.map((scene) => scene.affirmationIndex).filter((index) => index !== undefined));
  assert.deepStrictEqual([...used].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
}

function testRenderPayloadLeavesFluxScenesWithoutBackgroundImageUrl() {
  const scenes = buildScenesForRender({
    storyboard: storyboard(12),
    affirmations: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    emotionalImages: [0, 1, 2, 3, 4].map((i) => image(i, `https://example.com/${i}.jpg`)),
  });

  const uploadedCount = scenes.filter((scene) => scene.backgroundImageUrl?.startsWith('https://example.com/')).length;
  const fluxCount = scenes.filter((scene) => scene.backgroundImageUrl === undefined).length;

  assert.ok(uploadedCount > 0, 'some uploaded images should be used');
  assert.ok(uploadedCount < scenes.length, 'uploaded images must not replace every FLUX scene');
  assert.ok(fluxCount > uploadedCount, 'FLUX should remain the default visual source');
}

function main() {
  testUploadedImagesArePreferredWithoutReplacingFlux();
  testTooManyUploadedImagesAreCappedToPreserveFlux();
  testEveryAffirmationIsRepresentedWhenSceneCountAllowsIt();
  testRenderPayloadLeavesFluxScenesWithoutBackgroundImageUrl();
  console.log('✅ scene-plan tests passed');
}

main();
