/**
 * Publish Campaign Command Center — data assembly, rule-based ROI, insights.
 * Phase 1: client-side heuristics (no LLM). Phase 2 will blend ALwrity-ranked scores.
 */

import {
  filterCompleteLinkedInDrafts,
  getDraftAssetContent,
  getDraftContentType,
  type LinkedInDraftAsset,
  type LinkedInDraftContentType,
} from "./linkedInDraftLibraryUtils";

export type PublishCampaignHorizon = 7 | 14;

export type PublishCampaignRoiTier = "high" | "medium" | "low";

export type PublishCampaignItemSource = "calendar" | "asset_draft";

export type PublishCampaignItemStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "ready";

export interface CalendarEventRecord {
  id: number | string;
  title: string;
  description?: string;
  content_type?: string;
  platform?: string;
  scheduled_date?: string;
  status?: string;
  ai_recommendations?: Record<string, unknown>;
}

export interface PublishCampaignItem {
  id: string;
  source: PublishCampaignItemSource;
  contentType: LinkedInDraftContentType;
  title: string;
  scheduledAt?: string;
  status: PublishCampaignItemStatus;
  contentPreview?: string;
  roiTier: PublishCampaignRoiTier;
  roiScore: number;
  insights: string[];
  calendarEventId?: string;
  assetId?: string;
}

export type PublishCampaignInsightAction =
  | "quality_check"
  | "schedule"
  | "open_studio"
  | "open_calendar"
  | "reschedule";

export interface PublishCampaignInsight {
  id: string;
  priority: "high" | "medium" | "low";
  message: string;
  actionType?: PublishCampaignInsightAction;
  targetItemId?: string;
  ctaLabel?: string;
}

export interface PublishCampaignPayload {
  items: PublishCampaignItem[];
  insights: PublishCampaignInsight[];
  healthScore: number;
  horizonDays: PublishCampaignHorizon;
  scheduledCount: number;
  readyDraftCount: number;
}

const CONTENT_TYPE_ICONS: Record<LinkedInDraftContentType, string> = {
  post: "📝",
  article: "📄",
  carousel: "🎠",
  video_script: "🎬",
};

const CALENDAR_TYPE_ALIASES: Record<string, LinkedInDraftContentType> = {
  post: "post",
  social_post: "post",
  linkedin_post: "post",
  article: "article",
  blog_post: "article",
  linkedin_article: "article",
  carousel: "carousel",
  linkedin_carousel: "carousel",
  video_script: "video_script",
  video: "video_script",
};

/** Mon–Fri × 6 slots — high-reach windows (Technology default). */
const HIGH_REACH_SLOTS = new Set<string>([
  "1-1", "1-2", "2-1", "2-2", "2-3", "3-1", "3-2", "3-3", "4-1", "4-2",
]);

export function getCampaignContentTypeIcon(
  type: LinkedInDraftContentType,
): string {
  return CONTENT_TYPE_ICONS[type] ?? "📝";
}

function normalizeCalendarContentType(raw?: string): LinkedInDraftContentType {
  if (!raw) return "post";
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  return CALENDAR_TYPE_ALIASES[key] ?? "post";
}

function normalizeCalendarStatus(raw?: string): PublishCampaignItemStatus {
  const s = (raw ?? "draft").toLowerCase();
  if (s === "scheduled") return "scheduled";
  if (s === "published") return "published";
  return "draft";
}

function isLinkedInPlatform(platform?: string): boolean {
  return (platform ?? "").toLowerCase().includes("linkedin");
}

function parseEventDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTimingSlotKey(date: Date): string {
  const jsDay = date.getDay();
  if (jsDay === 0 || jsDay === 6) return "";
  const dayIndex = jsDay - 1;
  const hour = date.getHours();
  let slot = 5;
  if (hour < 9) slot = 0;
  else if (hour < 11) slot = 1;
  else if (hour < 13) slot = 2;
  else if (hour < 15) slot = 3;
  else if (hour < 17) slot = 4;
  return `${dayIndex}-${slot}`;
}

function isHighReachSlot(date: Date): boolean {
  const key = getTimingSlotKey(date);
  return key !== "" && HIGH_REACH_SLOTS.has(key);
}

function scoreToTier(score: number): PublishCampaignRoiTier {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function roiTierLabel(tier: PublishCampaignRoiTier): string {
  if (tier === "high") return "High ROI";
  if (tier === "medium") return "Medium ROI";
  return "Low ROI";
}

export { roiTierLabel };

function computeItemRoi(
  item: Omit<PublishCampaignItem, "roiScore" | "roiTier" | "insights">,
  now: Date,
): { roiScore: number; insights: string[] } {
  let score = 50;
  const insights: string[] = [];
  const scheduled = parseEventDate(item.scheduledAt);

  if (item.status === "scheduled") score += 15;
  if (item.status === "published") score += 5;

  if (item.contentPreview && item.contentPreview.length >= 120) {
    score += 10;
  } else if (item.contentPreview && item.contentPreview.length >= 60) {
    score += 5;
  } else {
    score -= 10;
    insights.push("Add or expand body content before publishing.");
  }

  if (item.contentType === "post") score += 5;
  if (item.contentType === "article") score += 3;

  if (scheduled) {
    if (scheduled.getTime() < now.getTime() && item.status !== "published") {
      score -= 25;
      insights.push("Past due — reschedule or publish soon.");
    } else if (isHighReachSlot(scheduled)) {
      score += 20;
      insights.push("Scheduled in a high-reach window for your industry.");
    } else {
      score += 5;
    }
  } else if (item.status === "ready" || item.status === "draft") {
    score -= 12;
    insights.push("Not on calendar yet — pick a slot to maximize reach.");
  }

  return { roiScore: Math.max(0, Math.min(100, score)), insights };
}

function calendarEventToItem(event: CalendarEventRecord): PublishCampaignItem {
  const contentType = normalizeCalendarContentType(event.content_type);
  const status = normalizeCalendarStatus(event.status);
  const preview = (event.description ?? "").trim();
  const base = {
    id: `cal-${event.id}`,
    source: "calendar" as const,
    contentType,
    title: event.title || "Untitled",
    scheduledAt: event.scheduled_date,
    status,
    contentPreview: preview.slice(0, 200),
    calendarEventId: String(event.id),
  };
  const { roiScore, insights } = computeItemRoi(base, new Date());
  return {
    ...base,
    roiScore,
    roiTier: scoreToTier(roiScore),
    insights,
  };
}

function draftAssetToItem(asset: LinkedInDraftAsset): PublishCampaignItem {
  const contentType = getDraftContentType(asset) ?? "post";
  const content = getDraftAssetContent(asset);
  const base = {
    id: `asset-${asset.id}`,
    source: "asset_draft" as const,
    contentType,
    title: asset.title || "Untitled Draft",
    status: "ready" as const,
    contentPreview: content.slice(0, 200),
    assetId: String(asset.id),
  };
  const { roiScore, insights } = computeItemRoi(base, new Date());
  return {
    ...base,
    roiScore,
    roiTier: scoreToTier(roiScore),
    insights,
  };
}

function isWithinHorizon(iso: string | undefined, horizonDays: number, now: Date): boolean {
  if (!iso) return true;
  const d = parseEventDate(iso);
  if (!d) return true;
  const end = new Date(now);
  end.setDate(end.getDate() + horizonDays);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  return d >= start && d <= end;
}

export function buildPublishCampaignPayload(
  events: CalendarEventRecord[],
  assets: LinkedInDraftAsset[],
  horizonDays: PublishCampaignHorizon = 7,
): PublishCampaignPayload {
  const now = new Date();
  const linkedInEvents = events.filter((e) => isLinkedInPlatform(e.platform));

  const calendarItems = linkedInEvents
    .filter((e) => {
      const st = (e.status ?? "").toLowerCase();
      if (st === "cancelled") return false;
      return isWithinHorizon(e.scheduled_date, horizonDays, now);
    })
    .map(calendarEventToItem);

  const calendarTitles = new Set(calendarItems.map((i) => i.title.toLowerCase()));

  const draftItems = filterCompleteLinkedInDrafts(assets, 20)
    .filter((a) => !calendarTitles.has((a.title ?? "").toLowerCase()))
    .map(draftAssetToItem);

  const items = [...calendarItems, ...draftItems].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    }
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return b.roiScore - a.roiScore;
  });

  const insights = buildCampaignInsights(items, horizonDays);
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;
  const readyDraftCount = items.filter((i) => i.source === "asset_draft").length;
  const healthScore = computeCampaignHealthScore(items);

  return {
    items,
    insights,
    healthScore,
    horizonDays,
    scheduledCount,
    readyDraftCount,
  };
}

function computeCampaignHealthScore(items: PublishCampaignItem[]): number {
  if (items.length === 0) return 0;
  let total = 0;
  for (const item of items) {
    let pts = item.roiScore * 0.6;
    if (item.contentPreview && item.contentPreview.length >= 60) pts += 15;
    if (item.scheduledAt) pts += 15;
    if (item.status === "published") pts += 10;
    total += Math.min(100, pts);
  }
  return Math.round(total / items.length);
}

function buildCampaignInsights(
  items: PublishCampaignItem[],
  horizonDays: PublishCampaignHorizon,
): PublishCampaignInsight[] {
  const insights: PublishCampaignInsight[] = [];
  const scheduled = items.filter((i) => i.status === "scheduled");
  const ready = items.filter((i) => i.source === "asset_draft");
  const lowRoi = items.filter((i) => i.roiTier === "low" && i.status !== "published");
  const pastDue = items.filter((i) =>
    i.insights.some((x) => x.includes("Past due")),
  );

  if (items.length === 0) {
    insights.push({
      id: "empty-campaign",
      priority: "high",
      message:
        "No LinkedIn content in your campaign window. Schedule from My Drafts or Create wedge.",
      actionType: "open_calendar",
      ctaLabel: "Create content",
    });
    return insights;
  }

  if (scheduled.length > 0) {
    insights.push({
      id: "scheduled-count",
      priority: "medium",
      message: `${scheduled.length} item${scheduled.length === 1 ? "" : "s"} scheduled in the next ${horizonDays} days — review timing for best reach.`,
      actionType: "open_calendar",
      ctaLabel: "Open calendar",
    });
  }

  if (ready.length > 0) {
    const first = ready[0];
    insights.push({
      id: "ready-drafts",
      priority: "high",
      message: `${ready.length} draft${ready.length === 1 ? "" : "s"} ready to schedule — "${first.title}" has content but no calendar slot yet.`,
      actionType: "schedule",
      targetItemId: first.id,
      ctaLabel: "Schedule draft",
    });
  }

  if (pastDue.length > 0) {
    insights.push({
      id: "past-due",
      priority: "high",
      message: `${pastDue.length} scheduled item${pastDue.length === 1 ? "" : "s"} ${pastDue.length === 1 ? "is" : "are"} past due. Reschedule or publish to stay on track.`,
      actionType: "reschedule",
      targetItemId: pastDue[0].id,
      ctaLabel: "Review item",
    });
  }

  if (lowRoi.length > 0) {
    const target = lowRoi[0];
    insights.push({
      id: "quality-low-roi",
      priority: "medium",
      message: `"${target.title}" has low predicted ROI — run a Quality Check and pick a high-reach time slot.`,
      actionType: "quality_check",
      targetItemId: target.id,
      ctaLabel: "Quality Check",
    });
  }

  const highRoi = items.filter((i) => i.roiTier === "high" && i.status === "scheduled");
  if (highRoi.length > 0 && insights.length < 5) {
    insights.push({
      id: "high-roi-win",
      priority: "low",
      message: `"${highRoi[0].title}" is ranked High ROI — prioritize finishing and publishing on schedule.`,
      targetItemId: highRoi[0].id,
    });
  }

  return insights.slice(0, 5);
}

export function findCampaignItemById(
  items: PublishCampaignItem[],
  id: string,
): PublishCampaignItem | undefined {
  return items.find((i) => i.id === id);
}

export function formatCampaignDateTime(iso?: string): string {
  if (!iso) return "Not scheduled";
  const d = parseEventDate(iso);
  if (!d) return "Not scheduled";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
