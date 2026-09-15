/**
 * Per-scope curated questions for "Ask your Brand Brain" (Phase 5).
 *
 * Drives the preset chips on the SemanticQuery panel so users have a launching
 * point that matches the current scope. Every scope is covered so the panel
 * never silently shows an empty preset row.
 */

import type { BrandBrainSearchScope } from '../../services/brandBrainApi';

export const SCOPE_PRESETS: Record<BrandBrainSearchScope, string[]> = {
  all: [
    "What's our brand voice?",
    'Summarize our content strategy',
    "What's coming up this month?",
  ],
  onboarding: [
    'Who is our target audience?',
    'Summarize our brand voice',
    'What content types do we prefer?',
  ],
  strategy: [
    'What are our strategic pillars?',
    'What risks has strategy flagged?',
    'What competitive insights do we have?',
  ],
  calendar: [
    "What's on the calendar this week?",
    'Any performance predictions for next month?',
    "What's the weekly theme?",
  ],
};