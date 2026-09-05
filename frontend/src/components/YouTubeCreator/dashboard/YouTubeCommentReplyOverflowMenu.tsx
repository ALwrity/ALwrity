import React, { useEffect, useRef, useState } from "react";

export const YouTubeCommentReplyOverflowMenu: React.FC<{
  onEdit: () => void;
}> = ({ onEdit }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="yt-comment-overflow" ref={wrapRef}>
      <button
        type="button"
        className="yt-comment-overflow-trigger"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋮
      </button>
      {open ? (
        <div className="yt-comment-overflow-menu" role="menu">
          <button
            type="button"
            className="yt-comment-overflow-item"
            role="menuitem"
            aria-label="Edit"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <svg
              className="yt-comment-overflow-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20zM14.5 5l4.5 4.5"
              />
            </svg>
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
};
