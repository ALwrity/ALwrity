import React from "react";
import { DashboardModalBackButton } from "./DashboardModalBackButton";
import { StudioModalCloseButton } from "./StudioModalCloseButton";

export type DashboardModalHeaderLayout = "default" | "centeredRow";

export interface DashboardActionModalHeaderProps {
  title: string;
  titleFontSize: number;
  titleSize: "default" | "lg" | "xl";
  onClose: () => void;
  disableClose?: boolean;
  closeLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  /** default: title left + close right; centeredRow: back left, title center, close right */
  headerLayout?: DashboardModalHeaderLayout;
  /** Optional custom title node (e.g. Quick Create Post/Article with icon). */
  titleContent?: React.ReactNode;
  /** Extra classes on the title element when using titleContent. */
  titleClassName?: string;
  titleId?: string;
}

function ModalCloseControl({
  disableClose,
  closeLabel,
  onClose,
}: {
  disableClose: boolean;
  closeLabel?: string;
  onClose: () => void;
}) {
  if (disableClose) return null;

  if (closeLabel) {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel ?? "Close"}
        style={{
          background: "transparent",
          border: "none",
          fontSize: 13,
          lineHeight: 1.2,
          cursor: "pointer",
          color: "#64748b",
          padding: "6px 10px",
          borderRadius: 6,
          fontWeight: 600,
          transition: "background 0.15s, color 0.15s",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#f3f4f6";
          e.currentTarget.style.color = "#0a66c2";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#64748b";
        }}
      >
        {closeLabel}
      </button>
    );
  }

  return <StudioModalCloseButton onClick={onClose} ariaLabel="Close" />;
}

function ModalTitle({
  title,
  titleFontSize,
  titleSize,
  titleContent,
  titleClassName,
  titleId = "dashboard-action-modal-title",
  centered,
}: {
  title: string;
  titleFontSize: number;
  titleSize: "default" | "lg" | "xl";
  titleContent?: React.ReactNode;
  titleClassName?: string;
  titleId?: string;
  centered?: boolean;
}) {
  const className = [
    "linkedin-dashboard-action-modal-title",
    centered ? "linkedin-dashboard-action-modal-title--centered" : "",
    `linkedin-dashboard-action-modal-title--${titleSize}`,
    titleClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <h2
      id={titleId}
      className={className}
      style={{
        margin: 0,
        fontSize: titleFontSize,
        fontWeight: 700,
        color: "#0a66c2",
        letterSpacing: "-0.01em",
        ...(centered
          ? {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              maxWidth: "100%",
            }
          : {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
            }),
      }}
    >
      {titleContent ?? title}
    </h2>
  );
}

export const DashboardActionModalHeader: React.FC<
  DashboardActionModalHeaderProps
> = ({
  title,
  titleFontSize,
  titleSize,
  onClose,
  disableClose = false,
  closeLabel,
  onBack,
  backLabel = "Back",
  headerLayout = "default",
  titleContent,
  titleClassName,
  titleId,
}) => {
  const closeControl = (
    <ModalCloseControl
      disableClose={disableClose}
      closeLabel={closeLabel}
      onClose={onClose}
    />
  );

  if (headerLayout === "centeredRow") {
    return (
      <div className="linkedin-dashboard-action-modal-header-row">
        <div
          className="linkedin-dashboard-action-modal-header-side linkedin-dashboard-action-modal-header-side--start"
          aria-hidden={onBack ? undefined : true}
        >
          {onBack ? (
            <DashboardModalBackButton
              label={backLabel}
              onClick={onBack}
              size="comfortable"
            />
          ) : null}
        </div>
        <ModalTitle
          title={title}
          titleFontSize={titleFontSize}
          titleSize={titleSize}
          titleContent={titleContent}
          titleClassName={titleClassName}
          titleId={titleId}
          centered
        />
        <div className="linkedin-dashboard-action-modal-header-side linkedin-dashboard-action-modal-header-side--end">
          {closeControl}
        </div>
      </div>
    );
  }

  const titleNode = (
    <ModalTitle
      title={title}
      titleFontSize={titleFontSize}
      titleSize={titleSize}
      titleContent={titleContent}
      titleClassName={titleClassName}
      titleId={titleId}
    />
  );

  if (onBack) {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {titleNode}
          {closeControl}
        </div>
        <div style={{ marginTop: 8 }}>
          <DashboardModalBackButton label={backLabel} onClick={onBack} />
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {titleNode}
      {closeControl}
    </div>
  );
};
