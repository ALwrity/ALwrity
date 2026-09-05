import React, { useEffect, useRef, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";

export const YouTubeCommentReplyOverflowMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
}> = ({ onEdit, onDelete }) => {
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
        <MoreVertRoundedIcon className="yt-comment-overflow-icon" aria-hidden="true" />
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
            <DriveFileRenameOutlineRoundedIcon
              className="yt-comment-overflow-icon"
              aria-hidden="true"
            />
            Edit
          </button>
          <button
            type="button"
            className="yt-comment-overflow-item"
            role="menuitem"
            aria-label="Delete"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <DeleteOutlineRoundedIcon
              className="yt-comment-overflow-icon"
              aria-hidden="true"
            />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
};
