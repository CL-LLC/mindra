type Scene = {
  affirmation: string;
  duration: number;
  imagePrompt: string;
  transition: "fade" | "cross-dissolve" | "swipe";
};

export type MindMovieScaffold = {
  affirmations: string[];
  storyboard: Scene[];
  assets: { type: "stock"; query: string; sceneIndex: number }[];
  duration: number;
  musicTrack: string;
};

function cleanGoal(goal: string) {
  return goal.replace(/[.]+$/g, "").trim();
}

function toAffirmation(goal: string) {
  const normalized = cleanGoal(goal);
  const lower = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  if (lower.startsWith("i ")) return `I ${lower.slice(2)}`;
  if (lower.startsWith("be ") || lower.startsWith("become ")) return `I ${lower}`;
  return `I am ${lower}`;
}

function titleMood(title: string) {
  const t = title.toLowerCase();
  if (t.includes("health") || t.includes("fit") || t.includes("energy")) {
    return { palette: "sunrise gold and electric blue", style: "athletic cinematic realism", musicTrack: "uplift-drive-120bpm" };
  }
  if (t.includes("wealth") || t.includes("business") || t.includes("money") || t.includes("career")) {
    return { palette: "deep navy, emerald, and warm gold", style: "premium editorial cinematic", musicTrack: "focus-vision-108bpm" };
  }
  return { palette: "violet dawn and crisp cyan", style: "aspirational cinematic realism", musicTrack: "future-self-rise-110bpm" };
}

export function buildDeterministicScaffold(title: string, goals: string[]): MindMovieScaffold {
  const safeGoals = goals.map(cleanGoal).filter(Boolean).slice(0, 6);
  const mood = titleMood(title);

  const affirmations = safeGoals.map(toAffirmation);

  const storyboard = affirmations.map((affirmation, i) => ({
    affirmation,
    duration: 10,
    transition: i % 2 === 0 ? "fade" : "cross-dissolve",
    imagePrompt: [
      `${mood.style}, ${mood.palette}`,
      `Scene ${i + 1}: visual metaphor for \"${affirmation}\"`,
      "high-detail, premium lighting, hopeful confident emotion",
      "35mm lens, subtle motion, clean composition",
    ].join(", "),
  })) as Scene[];

  const assets = safeGoals.map((goal, i) => ({
    type: "stock" as const,
    query: `${goal}, cinematic, ${mood.style}`,
    sceneIndex: i,
  }));

  return {
    affirmations,
    storyboard,
    assets,
    duration: storyboard.reduce((sum, s) => sum + s.duration, 0),
    musicTrack: mood.musicTrack,
  };
}
