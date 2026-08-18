import React, { useMemo, useState } from "react";
import { YouTubeActionModal } from "./YouTubeActionModal";
import {
  YOUTUBE_WORKFLOW_CARDS,
  type YouTubeWorkflowCardId,
} from "./youtubeWorkflowConfig";
import { openYouTubeWorkflowWedge } from "./youtubeStudioEvents";

const STORAGE_KEY = "yt_today_growth_v1";

type TaskStatus = "pending" | "done" | "skipped";

interface TodayTask {
  id: YouTubeWorkflowCardId;
  label: string;
  status: TaskStatus;
}

function defaultTasks(): TodayTask[] {
  return YOUTUBE_WORKFLOW_CARDS.map((c) => ({
    id: c.id,
    label: c.title,
    status: "pending" as TaskStatus,
  }));
}

function loadTasks(): TodayTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTasks();
    const parsed = JSON.parse(raw) as TodayTask[];
    if (!Array.isArray(parsed) || parsed.length !== 6) return defaultTasks();
    return parsed;
  } catch {
    return defaultTasks();
  }
}

export const YouTubeTodayGrowth: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TodayTask[]>(() => loadTasks());

  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks],
  );

  const persist = (next: TodayTask[]) => {
    setTasks(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setStatus = (id: YouTubeWorkflowCardId, status: TaskStatus) => {
    persist(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  return (
    <>
      <button
        type="button"
        className="yt-rail-btn"
        data-tour="yt-today-growth"
        onClick={() => setOpen(true)}
      >
        Today&apos;s Growth ({doneCount}/6)
      </button>

      <YouTubeActionModal
        open={open}
        title="Today's Growth Briefing"
        intro="Your 6-pillar YouTube authority routine — AI helps, you approve (HITL)."
        onClose={() => setOpen(false)}
        maxWidth={520}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((task) => {
            const card = YOUTUBE_WORKFLOW_CARDS.find((c) => c.id === task.id);
            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #e5e5e5",
                  borderRadius: 12,
                  padding: "10px 12px",
                  opacity: task.status === "skipped" ? 0.55 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{task.label}</div>
                  <div style={{ fontSize: 12, color: "#606060" }}>
                    {card?.description}
                  </div>
                </div>
                <button
                  type="button"
                  className="yt-rail-btn"
                  onClick={() => {
                    setOpen(false);
                    openYouTubeWorkflowWedge({ wedge: task.id });
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="yt-rail-btn yt-rail-btn--primary"
                  onClick={() => setStatus(task.id, "done")}
                  disabled={task.status === "done"}
                >
                  {task.status === "done" ? "Done" : "Complete"}
                </button>
                <button
                  type="button"
                  className="yt-rail-btn"
                  onClick={() => setStatus(task.id, "skipped")}
                >
                  Skip
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="yt-rail-btn"
            onClick={() => persist(defaultTasks())}
          >
            Reset today
          </button>
        </div>
      </YouTubeActionModal>
    </>
  );
};
