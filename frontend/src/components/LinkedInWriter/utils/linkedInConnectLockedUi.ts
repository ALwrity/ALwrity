export const LINKEDIN_CONNECT_LOCKED_HINT =
  "Connect LinkedIn to unlock this feature";

export const LINKEDIN_COPILOT_COMING_SOON_HINT =
  "Launching Soon ✨ — Chat to brainstorm ideas, refine drafts in real time, and stay on-brand with your persona.";

export const LINKEDIN_CONNECT_LOCKED_HINTS = {
  growth: "Connect LinkedIn to unlock today\u2019s growth tasks",
  optimiseProfile: "Connect LinkedIn to optimise your profile",
  search: "Connect LinkedIn to search people, companies, and posts",
  analytics: "Connect LinkedIn to view post analytics",
  workflow: (title: string) => `Connect LinkedIn to unlock ${title}`,
} as const;
