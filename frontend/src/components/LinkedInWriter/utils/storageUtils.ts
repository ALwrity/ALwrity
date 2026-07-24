// Storage utilities for LinkedIn Writer

// Storage keys
export const HISTORY_KEY = "linkedinwriter:chatHistory";
export const PREFS_KEY = "linkedinwriter:preferences";
export const CONTEXT_KEY = "linkedinwriter:context";

// Chat message type
export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  ts: number;
  action?: string; // Track which action was used
  result?: any; // Store action results for context
};

// User preferences interface
export interface LinkedInPreferences {
  tone: string;
  industry: string;
  target_audience: string;
  content_goals: string[];
  writing_style: string;
  hashtag_preferences: boolean;
  cta_preferences: boolean;
  last_used_actions: string[];
  favorite_topics: string[];
  last_updated?: number;
}

// Default preferences
export const defaultPreferences: LinkedInPreferences = {
  tone: "Professional",
  industry: "",
  target_audience: "",
  content_goals: ["Engagement", "Thought Leadership"],
  writing_style: "Clear and Concise",
  hashtag_preferences: true,
  cta_preferences: true,
  last_used_actions: [],
  favorite_topics: [],
};

// Validation functions
export function validateMessage(m: any): m is ChatMsg {
  return (
    m &&
    typeof m.content === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.ts === "number"
  );
}

// Chat history functions
export function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(validateMessage);
  } catch {
    console.warn(
      "[LinkedIn Writer] Failed to load chat history from localStorage",
    );
    return [];
  }
}

export function saveHistory(msgs: ChatMsg[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-50)));
  } catch (error) {
    console.warn(
      "[LinkedIn Writer] Failed to save chat history to localStorage:",
      error,
    );
  }
}

export function pushHistory(
  role: "user" | "assistant",
  content: string,
  action?: string,
  result?: any,
) {
  const msgs = loadHistory();
  msgs.push({
    role,
    content: String(content || "").slice(0, 4000),
    ts: Date.now(),
    action,
    result,
  });
  saveHistory(msgs);
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
    console.log("[LinkedIn Writer] Chat history cleared");
  } catch (error) {
    console.warn("[LinkedIn Writer] Failed to clear chat history:", error);
  }
}

export function getHistoryLength(): number {
  return loadHistory().length;
}

export function getRecentHistory(count: number = 10): ChatMsg[] {
  return loadHistory().slice(-count);
}

// Preferences functions
export function getPreferences(): LinkedInPreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return defaultPreferences;

    const parsed = JSON.parse(stored);
    return { ...defaultPreferences, ...parsed };
  } catch (error) {
    console.warn(
      "[LinkedIn Writer] Failed to load preferences, using defaults:",
      error,
    );
    return defaultPreferences;
  }
}

export function savePreferences(prefs: Partial<LinkedInPreferences>) {
  try {
    const current = getPreferences();
    const updated = { ...current, ...prefs, last_updated: Date.now() };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    console.log("[LinkedIn Writer] Preferences updated:", updated);
  } catch (error) {
    console.warn("[LinkedIn Writer] Failed to save preferences:", error);
  }
}

export function updatePreference(key: keyof LinkedInPreferences, value: any) {
  savePreferences({ [key]: value });
}

// Context functions
export function getCurrentContext(): string {
  try {
    return localStorage.getItem(CONTEXT_KEY) || "";
  } catch {
    return "";
  }
}

export function saveCurrentContext(context: string) {
  try {
    localStorage.setItem(CONTEXT_KEY, context);
  } catch (error) {
    console.warn("[LinkedIn Writer] Failed to save context:", error);
  }
}

// History summarization for AI context
export function summarizeHistory(maxChars: number = 1500): string {
  const msgs = loadHistory();
  if (!msgs.length) return "";

  const recent = msgs
    .slice(-15)
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}${m.action ? ` [Action: ${m.action}]` : ""}`,
    );

  const joined = recent.join("\n");
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}…` : joined;
}
