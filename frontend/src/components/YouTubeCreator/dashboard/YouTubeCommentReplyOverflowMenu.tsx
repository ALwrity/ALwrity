import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { YT_Z_MODAL } from "./youtubeStudioZIndex";

const YOUTUBE_COMMENT_OVERFLOW_MENU_MIN_PX = 140;

type YouTubeCommentOverflowMenuBox = {
  top: number;
  left: number;
};

function youtubeCommentOverflowMenuBox(
  trigger: HTMLElement | null,
): YouTubeCommentOverflowMenuBox | null {
  if (!trigger) {
    return null;
  }
  const rect = trigger.getBoundingClientRect();
  return {
    top: Math.round(rect.bottom + 4),
    left: Math.round(rect.right - YOUTUBE_COMMENT_OVERFLOW_MENU_MIN_PX),
  };
}

export const YouTubeCommentReplyOverflowMenu: React.FC<{
  onEdit: () => void;
  onDelete: () => void;
}> = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<YouTubeCommentOverflowMenuBox | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    if (open) {
      console.info("[YouTubeCommentReplyOverflow] Menu closed");
    }
    setOpen(false);
    setMenuBox(null);
  };

  const openMenu = () => {
    if (typeof document === "undefined") {
      console.error("[YouTubeCommentReplyOverflow] Cannot portal menu — document is unavailable");
      return;
    }
    const box = youtubeCommentOverflowMenuBox(triggerRef.current);
    if (!box) {
      console.warn("[YouTubeCommentReplyOverflow] Menu position unavailable");
      return;
    }
    console.info("[YouTubeCommentReplyOverflow] Menu opened");
    setMenuBox(box);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const syncMenuBox = () => {
      const box = youtubeCommentOverflowMenuBox(triggerRef.current);
      if (!box) {
        console.warn("[YouTubeCommentReplyOverflow] Menu position unavailable");
        setOpen(false);
        setMenuBox(null);
        return;
      }
      setMenuBox(box);
    };
    window.addEventListener("resize", syncMenuBox);
    window.addEventListener("scroll", syncMenuBox, true);
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      console.info("[YouTubeCommentReplyOverflow] Menu closed");
      setOpen(false);
      setMenuBox(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      console.info("[YouTubeCommentReplyOverflow] Menu closed");
      setOpen(false);
      setMenuBox(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("resize", syncMenuBox);
      window.removeEventListener("scroll", syncMenuBox, true);
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const menu =
    open && menuBox ? (
      createPortal(
        <div
          ref={menuRef}
          className="yt-comment-overflow-menu yt-comment-overflow-menu--portal"
          role="menu"
          style={{
            top: menuBox.top,
            left: Math.max(8, menuBox.left),
            zIndex: YT_Z_MODAL,
          }}
        >
          <button
            type="button"
            className="yt-comment-overflow-item"
            role="menuitem"
            aria-label="Edit"
            onClick={() => {
              closeMenu();
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
              closeMenu();
              onDelete();
            }}
          >
            <DeleteOutlineRoundedIcon
              className="yt-comment-overflow-icon"
              aria-hidden="true"
            />
            Delete
          </button>
        </div>,
        document.body,
      )
    ) : null;

  return (
    <div className="yt-comment-overflow" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="yt-comment-overflow-trigger"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          openMenu();
        }}
      >
        <MoreVertRoundedIcon className="yt-comment-overflow-icon" aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
};
