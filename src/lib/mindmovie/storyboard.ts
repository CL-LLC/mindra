export type NormalizedStoryboardScene = {
  affirmation: string;
  duration: number;
  imagePrompt: string;
  transition: 'fade' | 'cross-dissolve' | 'swipe';
  title?: string;
  description?: string;
  text?: string;
};

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function getSceneCopy(scene: Partial<NormalizedStoryboardScene> & Record<string, unknown>, index: number) {
  const title = cleanText(scene.title);
  const affirmation = cleanText(scene.affirmation);
  const description = cleanText(scene.description);
  const text = cleanText(scene.text);
  const copy = title || affirmation || description || text || `Scene ${index + 1}`;

  return {
    title: title || `Scene ${index + 1}`,
    description: description || affirmation || text || copy,
    affirmation: affirmation || description || text || title || copy,
  };
}

export function normalizeStoryboardScene(
  scene: Partial<NormalizedStoryboardScene> & Record<string, unknown>,
  index: number
): NormalizedStoryboardScene {
  const copy = getSceneCopy(scene, index);
  const duration = typeof scene.duration === 'number' && Number.isFinite(scene.duration) ? scene.duration : 10;
  const imagePrompt = cleanText(scene.imagePrompt) || `${copy.description}`;
  const transition = scene.transition === 'cross-dissolve' || scene.transition === 'swipe' || scene.transition === 'fade'
    ? scene.transition
    : 'fade';

  return {
    ...scene,
    title: copy.title,
    description: copy.description,
    affirmation: copy.affirmation,
    duration,
    imagePrompt,
    transition,
  };
}

export function normalizeStoryboard(storyboard: unknown): NormalizedStoryboardScene[] {
  if (!Array.isArray(storyboard)) return [];
  return storyboard.map((scene, index) => normalizeStoryboardScene((scene ?? {}) as any, index));
}
