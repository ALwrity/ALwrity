/**
 * Performance-to-Plan Bridge (Perf → Plan) — tile, modal, and remix angle config.
 */

export const PERF_TO_PLAN_TILE = {
  title: "Perf → Plan",
  description: "Extract winning topics from top posts, generate 5 remix ideas",
  icon: "📈",
  accent: "#0a66c2",
} as const;

export const PERF_TO_PLAN_MODAL_TITLE = "Performance-to-Plan Bridge";

export const PERF_TO_PLAN_MODAL_INTRO =
  "Your top-performing topics, turned into 5 ready-to-create post ideas. Based on what's already proven to work.";

export const REMIX_ANGLES = [
  "What I learned from this",
  "The contrarian take",
  "Step-by-step breakdown",
  "Common myths debunked",
  "Behind the scenes story",
] as const;

export const PERF_TO_PLAN_LOCKED_HINT =
  "Coming soon — this format will be available in a future update.";
