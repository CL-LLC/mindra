import { normalizeStoryboard } from '@/lib/mindmovie/storyboard';
import type { EmotionalImageMeta } from './render-payload';

export type VisualSource = 'flux_generated' | 'uploaded_direct';

export type ScenePlanEntry = {
  sceneIndex: number;
  title?: string;
  description?: string;
  affirmation?: string;
  affirmationIndex?: number;
  duration?: number;
  imagePrompt?: string;
  visualSource: VisualSource;
  backgroundImageUrl?: string;
  emotionalImage?: EmotionalImageMeta;
};

export type ScenePlanInput = {
  storyboard: unknown;
  affirmations?: string[];
  emotionalImages?: EmotionalImageMeta[];
};

/**
 * Mindra Creative Director scene planner.
 *
 * Decides which scenes are personal-photo anchors and which scenes remain FLUX-generated.
 * Uploaded images should deepen emotional connection, not replace the entire movie.
 */
export function buildMindMovieScenePlan(input: ScenePlanInput): ScenePlanEntry[] {
  const scenes = normalizeStoryboard(input.storyboard);
  const sceneCount = scenes.length;
  const affirmations = Array.isArray(input.affirmations) ? input.affirmations.filter(Boolean) : [];
  const directImages = (Array.isArray(input.emotionalImages) ? input.emotionalImages : [])
    .filter((image) => (image.usageMode === 'direct' || image.usageMode === 'both') && Boolean(image.imageUrl));

  const exactImages = directImages.filter((image) => image.sceneIndex !== undefined);
  const proportionalImages = directImages.filter((image) => image.sceneIndex === undefined);
  const exactSceneIndexes = new Set(exactImages.map((image) => image.sceneIndex).filter((index): index is number => index !== undefined));
  const maxAnchorScenes = Math.max(0, Math.ceil(sceneCount * 0.4));
  const remainingAnchorSlots = Math.max(0, maxAnchorScenes - exactSceneIndexes.size);
  const selectedProportionalImages = proportionalImages.slice(0, remainingAnchorSlots);
  const freeSceneIndexes = Array.from({ length: sceneCount }, (_, index) => index)
    .filter((index) => !exactSceneIndexes.has(index));
  const proportionalAssignments = distributeAnchors(selectedProportionalImages, freeSceneIndexes);

  return scenes.map((scene: any, index: number) => {
    const affirmationIndex = proportionalIndex(index, sceneCount, affirmations.length);
    const exactImage = exactImages.find((image) => image.sceneIndex === index);
    const proportionalImage = proportionalAssignments.get(index);
    const emotionalImage = exactImage ?? proportionalImage;

    return {
      sceneIndex: index,
      title: scene.title,
      description: scene.description,
      affirmation: affirmationIndex === undefined ? scene.affirmation : affirmations[affirmationIndex],
      affirmationIndex,
      duration: scene.duration,
      imagePrompt: scene.imagePrompt,
      visualSource: emotionalImage ? 'uploaded_direct' : 'flux_generated',
      backgroundImageUrl: emotionalImage?.imageUrl,
      emotionalImage,
    };
  });
}

function distributeAnchors(images: EmotionalImageMeta[], sceneIndexes: number[]): Map<number, EmotionalImageMeta> {
  const assignments = new Map<number, EmotionalImageMeta>();
  if (images.length === 0 || sceneIndexes.length === 0) return assignments;

  for (let index = 0; index < images.length; index += 1) {
    const sceneIndex = sceneIndexes[Math.floor((index * sceneIndexes.length) / images.length)];
    if (sceneIndex !== undefined && !assignments.has(sceneIndex)) {
      assignments.set(sceneIndex, images[index]);
    }
  }

  return assignments;
}

function proportionalIndex(sceneIndex: number, sceneCount: number, itemCount: number): number | undefined {
  if (sceneCount <= 0 || itemCount <= 0) return undefined;
  return Math.min(itemCount - 1, Math.floor((sceneIndex * itemCount) / sceneCount));
}
