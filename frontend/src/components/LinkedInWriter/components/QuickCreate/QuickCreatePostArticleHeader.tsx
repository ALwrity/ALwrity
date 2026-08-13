import React from "react";
import { DashboardModalBackButton } from "../dashboard/DashboardModalBackButton";
import { StudioModalCloseButton } from "../dashboard/StudioModalCloseButton";
import type { QuickCreateReturnTarget } from "../dashboard/engagementWedgeNavigation";

export interface QuickCreatePostArticleHeaderProps {
  type: "post" | "article";
  returnTo: QuickCreateReturnTarget | null;
  onBack: () => void;
  onClose: () => void;
}

function PostArticleTitle({ type }: { type: "post" | "article" }) {
  if (type === "post") {
    return (
      <>
        <span className="linkedin-quick-create-title__icon" aria-hidden>
          📝
        </span>
        <span className="linkedin-quick-create-title__text">Post</span>
      </>
    );
  }

  return (
    <>
      <span
        className="linkedin-quick-create-title__icon linkedin-quick-create-title__icon--article"
        aria-hidden
      >
        📄
      </span>
      <span className="linkedin-quick-create-title__text">Article</span>
    </>
  );
}

/** Post / Article generation modal — back left, icon + title center, close right. */
export const QuickCreatePostArticleHeader: React.FC<
  QuickCreatePostArticleHeaderProps
> = ({ type, returnTo, onBack, onClose }) => (
  <div className="linkedin-quick-create-modal-header-row">
    <div className="linkedin-quick-create-modal-header-side linkedin-quick-create-modal-header-side--start">
      {returnTo ? (
        <DashboardModalBackButton
          label={returnTo.label}
          onClick={onBack}
          size="comfortable"
        />
      ) : null}
    </div>
    <h2
      id="linkedin-quick-create-title"
      className={[
        "linkedin-quick-create-modal-header-title",
        "linkedin-quick-create-title",
        "linkedin-quick-create-title--xl",
        type === "article" ? "linkedin-quick-create-title--article" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PostArticleTitle type={type} />
    </h2>
    <div className="linkedin-quick-create-modal-header-side linkedin-quick-create-modal-header-side--end">
      <StudioModalCloseButton onClick={onClose} ariaLabel="Close quick create" />
    </div>
  </div>
);
