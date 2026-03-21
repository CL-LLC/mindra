import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Set it in Convex env before using AI functions.");
  }
  return new OpenAI({ apiKey });
}

function normalizeAffirmation(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\-•\d.\)\s]+/, "")
    .replace(/["'`]+/g, "")
    .trim();
}

function diversifyAffirmations(goals: string[], affirmations: string[]) {
  const identityStarters = ["I am", "I know", "I trust", "I embody", "I become"];
  const actionStarters = ["I move", "I build", "I choose", "I create", "I practice"];
  const groundingStarters = ["I deserve", "I accept", "I welcome", "I allow", "I honor"];

  const cleanedGoals = goals.map((goal) => goal.trim()).filter(Boolean);
  const goalFocus = cleanedGoals.slice(0, 7);

  const output: string[] = [];
  const seen = new Set<string>();

  for (const raw of affirmations) {
    const normalized = normalizeAffirmation(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  const templates = [
    (goal: string) => `${identityStarters[0]} already becoming ${goal.replace(/^i\s+/i, "").replace(/^to\s+/i, "")}`,
    (goal: string) => `${groundingStarters[0]} the life I am building around ${goal}`,
    (goal: string) => `${actionStarters[0]} with steady confidence toward ${goal}`,
    (goal: string) => `${identityStarters[3]} the version of me who achieves ${goal}`,
    (goal: string) => `${actionStarters[3]} my future through daily action`,
  ];

  let idx = 0;
  while (output.length < 7 && goalFocus.length > 0) {
    const goal = goalFocus[idx % goalFocus.length];
    const candidate = normalizeAffirmation(templates[idx % templates.length](goal));
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(candidate);
    }
    idx += 1;
    if (idx > 20) break;
  }

  return output.slice(0, 7);
}

// Generate storyboard from goals and affirmations
export const generateStoryboard = action({
  args: {
    title: v.string(),
    goals: v.array(v.string()),
    affirmations: v.array(v.string()),
    duration: v.number(),
  },
  returns: v.object({
    storyboard: v.array(v.any()),
    assets: v.array(v.any()),
    musicTrack: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    // Call OpenAI to generate storyboard
    const prompt = `Create a storyboard for a ${args.duration}-second AI mind movie with this title: "${args.title}". 
    Goals: ${args.goals.join(", ")}
    Affirmations: ${args.affirmations.join(", ")}
    
    Please provide:
    1. Storyboard: Array of scenes with descriptions (scene, description, visualStyle, emotion)
    2. Assets: Array of recommended stock footage or image IDs for each scene
    3. MusicTrack: A specific copyright-free music track from Unsplash or similar that matches the vibe
    
    Return as JSON array of 10-15 scenes.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a storyboard expert for AI-generated mind movies. Output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate storyboard from OpenAI");
    }

    const storyboardData = JSON.parse(content);

    return {
      storyboard: storyboardData.storyboard || [],
      assets: storyboardData.assets || [],
      musicTrack: storyboardData.musicTrack || "upbeat-inspirational-music-0e2e3",
    };
  },
});

// Generate affirmations from goals
export const generateAffirmations = action({
  args: {
    goals: v.array(v.string()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    const prompt = `Create 7 deeply transformed affirmations for these goals:
    ${args.goals.join(", ")}

    Rules:
    - Do NOT copy the user goals verbatim
    - Turn each goal into a vivid identity statement
    - Make the language emotionally resonant, grounded, and specific
    - Use present tense and first person
    - Vary the structure so the list does not feel repetitive
    - Keep each line short enough to remember, but not robotic
    - Aim for 4-12 words per affirmation
    - At least 2 affirmations should be about identity/self-worth, not just outcomes
    - At least 2 affirmations should imply action, momentum, or consistency

    Return valid JSON only in the form:
    { "affirmations": ["...", "..."] }`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert manifestation writer. You turn ordinary goals into powerful identity-shifting affirmations. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate affirmations from OpenAI");
    }

    const data = JSON.parse(content);
    const affirmations: unknown[] = Array.isArray(data.affirmations) ? data.affirmations : [];
    return diversifyAffirmations(args.goals, affirmations.map((item: unknown) => String(item)));

  },
});

// Generate summary for effectiveness scoring
export const generateMindMovieSummary = action({
  args: {
    title: v.string(),
    version: v.optional(v.number()),
    goals: v.array(v.string()),
    affirmations: v.array(v.string()),
  },
  returns: v.object({
    summary: v.string(),
    effectivenessScore: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    const prompt = `Analyze this mind movie for effectiveness:
    Title: ${args.title}
    Goals: ${args.goals.join(", ")}
    Affirmations: ${args.affirmations.join(", ")}
    Version: ${args.version || 1}
    
    Provide:
    1. A brief summary of the content
    2. An effectiveness score from 1-10 (0.1 increments)
    
    Return as JSON object.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing mind movie effectiveness. Output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate summary from OpenAI");
    }

    const data = JSON.parse(content);
    return {
      summary: data.summary || "",
      effectivenessScore: data.effectivenessScore || 0,
    };
  },
});

// Generate emotional analysis for scene
export const analyzeSceneEmotion = action({
  args: {
    sceneDescription: v.string(),
  },
  returns: v.object({
    emotion: v.string(),
    mood: v.string(),
    colorPalette: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: Please sign in");
    }

    const prompt = `Analyze this scene description and return:
    1. emotion: The primary emotion (e.g., "inspired", "confident", "calm")
    2. mood: The overall mood (e.g., "uplifting", "grounded", "energetic")
    3. colorPalette: 3-5 colors that match the scene (e.g., ["#FFD700", "#87CEEB", "#FFFFFF"])
    
    Output valid JSON object.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing scene descriptions for video production. Output valid JSON only.",
        },
        {
          role: "user",
          content: args.sceneDescription,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to analyze scene emotion");
    }

    return JSON.parse(content);
  },
});
