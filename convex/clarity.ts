import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

// Clarity Engine - Extract themes and generate affirmations from user goals
export const processGoals: any = action({
  args: {
    goals: v.array(v.string()),
    categories: v.array(v.string()),
  },
  returns: v.object({
    themes: v.array(v.string()),
    affirmations: v.array(v.string()),
    storyboard: v.array(v.object({
      affirmation: v.string(),
      duration: v.number(),
      imagePrompt: v.string(),
      transition: v.string(),
    })),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{ themes: string[]; affirmations: string[]; storyboard: { affirmation: string; duration: number; imagePrompt: string; transition: string }[] }> => {
    const themes = args.goals
      .map((goal) => goal.split(' ').filter((word) => word.length > 5).slice(0, 3))
      .flat();

    const uniqueThemes = [...new Set(themes)];

    const affirmations = (await ctx.runAction(api.aiFunctions.generateAffirmations, {
      goals: args.goals,
    })) as string[];

    const storyboardResult = (await ctx.runAction(api.aiFunctions.generateStoryboard, {
      title: 'My Mind Movie',
      goals: args.goals,
      affirmations,
      duration: 120,
    })) as { storyboard?: { affirmation: string; duration: number; imagePrompt: string; transition: string }[] };

    return {
      themes: uniqueThemes,
      affirmations,
      storyboard: storyboardResult.storyboard || [],
    };
  },
});
