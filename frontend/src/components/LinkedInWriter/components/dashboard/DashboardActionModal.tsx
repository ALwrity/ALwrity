import React from "react";
import { createPortal } from "react-dom";
import {
  LI_Z_ELEVATED_MODAL,
  LI_Z_MODAL,
} from "../../utils/linkedInStudioZIndex";
import { DashboardActionModalHeader } from "./DashboardActionModalHeader";
import type { DashboardModalHeaderLayout } from "./DashboardActionModalHeader";

interface DashboardActionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  maxHeight?: string;
  minWidth?: number | string;
  minHeight?: number | string;
  zIndex?: number;
  disableClose?: boolean;
  /** Title scale: default 15px, lg 18px, xl 24px (primary workflow wedges). */
  titleSize?: "default" | "lg" | "xl";
  /** Text close control instead of ✕ (e.g. "Explore first"). */
  closeLabel?: string;
  /** Above studio tour / error overlays when set. */
  elevated?: boolean;
  /** Optional class on the modal panel (for mobile-specific layout tweaks). */
  modalClassName?: string;
  /** Optional sticky footer (e.g. mobile Done button). */
  footer?: React.ReactNode;
  /** When false, modal body does not scroll internally. Default true. */
  scrollBody?: boolean;
  /** Optional back navigation (e.g. return to parent wedge grid). */
  onBack?: () => void;
  /** Short label for back button — defaults to "Back". */
  backLabel?: string;
  /** default: title left + close right; centeredRow: back left, title center, close right */
  headerLayout?: DashboardModalHeaderLayout;
}

export const DashboardActionModal: React.FC<DashboardActionModalProps> = ({
  open,
  title,
  onClose,
  children,
  width,
  maxWidth = 720,
  height,
  maxHeight = "min(90vh, 640px)",
  minWidth,
  minHeight,
  zIndex = LI_Z_MODAL,
  disableClose = false,
  titleSize = "default",
  closeLabel,
  elevated = false,
  modalClassName,
  footer,
  scrollBody = true,
  onBack,
  backLabel = "Back",
  headerLayout = "default",
}) => {
  if (!open) return null;

  const handleBackdropClose = () => {
    if (!disableClose) onClose();
  };

  const modalZIndex = elevated ? LI_Z_ELEVATED_MODAL : zIndex;

  const titleFontSize =
    titleSize === "xl" ? 24 : titleSize === "lg" ? 18 : 15;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-action-modal-title"
      className="linkedin-dashboard-action-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: modalZIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.38)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 24,
      }}
      onClick={handleBackdropClose}
    >
      <div
        className={
          modalClassName
            ? `linkedin-dashboard-action-modal ${modalClassName}`
            : "linkedin-dashboard-action-modal"
        }
        onClick={(e) => e.stopPropagation()}
        style={{
          width: width ?? "100%",
          maxWidth,
          height,
          maxHeight,
          minWidth,
          minHeight,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          className="linkedin-dashboard-action-modal-header"
          style={{
            padding: "12px 20px 10px",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <DashboardActionModalHeader
            title={title}
            titleFontSize={titleFontSize}
            titleSize={titleSize}
            onClose={onClose}
            disableClose={disableClose}
            closeLabel={closeLabel}
            onBack={onBack}
            backLabel={backLabel}
            headerLayout={headerLayout}
          />
        </div>
        <div
          className="linkedin-dashboard-action-modal-body"
          style={{
            padding: 20,
            overflowY: scrollBody ? "auto" : "visible",
            overflowX: "hidden",
            flex: scrollBody ? 1 : "0 1 auto",
            minHeight: scrollBody ? 0 : undefined,
          }}
        >
          {children}
        </div>
        {footer ? (
          <div className="linkedin-dashboard-action-modal-footer">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
