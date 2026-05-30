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
 * User uploads are treated as high-priority emotional anchors: show every uploaded image
 * at least once when scene count allows, while reserving some scenes for FLUX expansion.
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
  const reservedFluxScenes = sceneCount <= 1 ? 0 : Math.max(1, Math.ceil(sceneCount * 0.25));
  const maxAnchorScenes = Math.max(0, sceneCount - reservedFluxScenes);
  const remainingAnchorSlots = Math.max(0, maxAnchorScenes - exactSceneIndexes.size);
  const selectedProportionalImages = proportionalImages.slice(0, remainingAnchorSlots);
  const freeSceneIndexes = Array.from({ length: sceneCount }, (_, index) => index)
    .filter((index) => !exactSceneIndexes.has(index));
  const plannedAffirmationIndexes = scenes.map((scene: any, index: number) =>
    resolveAffirmationIndex(scene, index, sceneCount, affirmations.length)
  );
  const proportionalAssignments = distributeAnchors(selectedProportionalImages, freeSceneIndexes, scenes, plannedAffirmationIndexes);

  return scenes.map((scene: any, index: number) => {
    const affirmationIndex = plannedAffirmationIndexes[index];
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

function distributeAnchors(
  images: EmotionalImageMeta[],
  sceneIndexes: number[],
  scenes: Array<Record<string, unknown>>,
  plannedAffirmationIndexes: Array<number | undefined>
): Map<number, EmotionalImageMeta> {
  const assignments = new Map<number, EmotionalImageMeta>();
  if (images.length === 0 || sceneIndexes.length === 0) return assignments;

  const available = new Set(sceneIndexes);
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const sceneIndex = chooseBestSceneForImage(image, Array.from(available), scenes, plannedAffirmationIndexes, index, images.length);
    if (sceneIndex !== undefined) {
      assignments.set(sceneIndex, image);
      available.delete(sceneIndex);
    }
  }

  return assignments;
}

function chooseBestSceneForImage(
  image: EmotionalImageMeta,
  availableSceneIndexes: number[],
  scenes: Array<Record<string, unknown>>,
  plannedAffirmationIndexes: Array<number | undefined>,
  imageIndex: number,
  imageCount: number
): number | undefined {
  if (availableSceneIndexes.length === 0) return undefined;

  if (typeof image.goalIndex === 'number' && Number.isFinite(image.goalIndex)) {
    const matchingGoalScene = availableSceneIndexes.find((sceneIndex) => scenes[sceneIndex]?.goalIndex === image.goalIndex);
    if (matchingGoalScene !== undefined) return matchingGoalScene;

    const matchingAffirmationScene = availableSceneIndexes.find(
      (sceneIndex) => plannedAffirmationIndexes[sceneIndex] === image.goalIndex
    );
    if (matchingAffirmationScene !== undefined) return matchingAffirmationScene;
  }

  const spreadIndex = Math.floor((imageIndex * availableSceneIndexes.length) / Math.max(1, imageCount));
  return availableSceneIndexes[Math.min(availableSceneIndexes.length - 1, spreadIndex)];
}

function resolveAffirmationIndex(
  scene: Record<string, unknown>,
  sceneIndex: number,
  sceneCount: number,
  affirmationCount: number
): number | undefined {
  const explicit = scene.affirmationIndex;
  if (typeof explicit === 'number' && Number.isInteger(explicit) && explicit >= 0 && explicit < affirmationCount) {
    return explicit;
  }
  return proportionalIndex(sceneIndex, sceneCount, affirmationCount);
}

function proportionalIndex(sceneIndex: number, sceneCount: number, itemCount: number): number | undefined {
  if (sceneCount <= 0 || itemCount <= 0) return undefined;
  return Math.min(itemCount - 1, Math.floor((sceneIndex * itemCount) / sceneCount));
}
