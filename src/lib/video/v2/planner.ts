/**
 * V1Planner — Identity mapping: one shot per scene.
 * This is the simplest planner and produces output identical to V1 inline logic.
 */
import type { Planner, RenderPlan, ShotPlan, RenderSceneV2, RenderOptionsV2 } from './types';

export class V1Planner implements Planner {
  async plan(scenes: RenderSceneV2[], options: RenderOptionsV2): Promise<RenderPlan> {
    const width = options.width ?? 1280;
    const height = options.height ?? 720;
    const fps = options.fps ?? 30;

    const shots: ShotPlan[] = scenes.map((scene, i) => ({
      sceneIndex: i,
      shotId: `shot-${i}`,
      affirmation: scene.affirmation,
      durationSec: scene.duration,
      imagePrompt: scene.imagePrompt ?? scene.affirmation,
      backgroundColor: scene.backgroundColor ?? '#000000',
      backgroundImageUrl: scene.backgroundImageUrl,
      language: scene.language,
      title: scene.title,
      description: scene.description,
    }));

    return {
      shots,
      globalOptions: {
        width,
        height,
        fps,
        musicTrack: options.musicTrack,
      },
    };
  }
}
