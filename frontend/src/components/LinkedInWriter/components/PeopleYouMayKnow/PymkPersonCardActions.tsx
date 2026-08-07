import React from "react";
import type { PymkSuggestionItem } from "../../../../services/linkedInPymkApi";
import { resolvePymkConnectAction } from "../dashboard/pymkConnectAction";
import { DraftOutreachButton } from "../dashboard/OutreachNoteDisplay";

export interface PymkPersonCardActionsProps {
  person: PymkSuggestionItem;
  enableOutreach: boolean;
  hasDraft: boolean;
  isDrafting: boolean;
  onDraftOutreach?: () => void;
}

export const PymkPersonCardActions: React.FC<PymkPersonCardActionsProps> = ({
  person,
  enableOutreach,
  hasDraft,
  isDrafting,
  onDraftOutreach,
}) => {
  const connectAction = resolvePymkConnectAction(person);
  const showDraft =
    enableOutreach && !hasDraft && Boolean(onDraftOutreach);

  const connectClass = [
    "pymk-card-actions__btn",
    connectAction.variant === "connect" && "pymk-card-actions__btn--connect",
    connectAction.variant === "pending" && "pymk-card-actions__btn--pending",
    connectAction.variant === "connected" &&
      "pymk-card-actions__btn--connected",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="pymk-card-actions" data-testid="pymk-card-actions">
      {showDraft && (
        <DraftOutreachButton
          isDrafting={isDrafting}
          onClick={onDraftOutreach!}
          compact
          className="pymk-card-actions__btn pymk-card-actions__btn--draft"
        />
      )}

      {connectAction.disabled ? (
        <button
          type="button"
          disabled
          title={connectAction.title}
          className={connectClass}
        >
          {connectAction.label}
        </button>
      ) : (
        <a
          href={connectAction.href}
          target="_blank"
          rel="noopener noreferrer"
          title={connectAction.title}
          data-testid="pymk-connect-link"
          className={connectClass}
        >
          {connectAction.label}
        </a>
      )}
    </div>
  );
};
