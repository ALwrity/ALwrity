import React from "react";
import type { PymkSuggestionItem } from "../../../../services/linkedInPymkApi";
import { buildAuthenticatedImageUrl } from "../../../../services/linkedInPymkApi";
import { colors } from "../GrowthEngine/styles";
import { OutreachNoteDisplay } from "../dashboard/OutreachNoteDisplay";
import { PymkPersonCardActions } from "./PymkPersonCardActions";

export interface PymkPersonCardProps {
  person: PymkSuggestionItem;
  /** When set, shows draft outreach actions (Grow Network P1). */
  enableOutreach?: boolean;
  draftText?: string;
  isDrafting?: boolean;
  onDraftOutreach?: () => void;
  onClose?: () => void;
}

export const PymkPersonCard: React.FC<PymkPersonCardProps> = ({
  person,
  enableOutreach = false,
  draftText,
  isDrafting = false,
  onDraftOutreach,
  onClose,
}) => {
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const [bgFailed, setBgFailed] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const hasDraft = Boolean(draftText);

  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const photoUrl = buildAuthenticatedImageUrl(person.photo_url ?? "");
  const bgUrl = buildAuthenticatedImageUrl(person.background_url ?? "");

  React.useEffect(() => {
    if (
      (person.photo_url || person.background_url) &&
      !photoUrl &&
      !bgUrl &&
      retryCount < 5
    ) {
      const timer = setTimeout(
        () => setRetryCount((c) => c + 1),
        500 * (retryCount + 1),
      );
      return () => clearTimeout(timer);
    }
  }, [person.photo_url, person.background_url, photoUrl, bgUrl, retryCount]);

  const showPhoto = Boolean(photoUrl) && !photoFailed;
  const showBackground = Boolean(bgUrl) && !bgFailed;

  return (
    <article
      className="pymk-person-card"
      data-testid={`pymk-person-card-${person.profile_id}`}
    >
      <div
        className="pymk-person-card__banner"
        style={{
          background: showBackground
            ? `url(${bgUrl}) center/cover no-repeat`
            : undefined,
        }}
      >
        {showBackground && (
          <img
            src={bgUrl!}
            alt=""
            onError={() => setBgFailed(true)}
            style={{ display: "none" }}
          />
        )}
      </div>

      <div className="pymk-person-card__avatar-wrap">
        {showPhoto ? (
          <img
            src={photoUrl!}
            alt=""
            width={72}
            height={72}
            onError={() => setPhotoFailed(true)}
            className="pymk-person-card__avatar"
          />
        ) : (
          <div aria-hidden="true" className="pymk-person-card__avatar-fallback">
            {initials || "?"}
          </div>
        )}
      </div>

      <div className="pymk-person-card__body">
        <a
          href={person.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          className="pymk-person-card__name"
        >
          {person.name}
        </a>

        {person.headline && (
          <p className="pymk-person-card__headline">{person.headline}</p>
        )}

        {person.mutual_connections_text && (
          <p className="pymk-person-card__mutual">{person.mutual_connections_text}</p>
        )}

        {hasDraft && draftText && (
          <OutreachNoteDisplay note={draftText} onClose={onClose} compact />
        )}

        <PymkPersonCardActions
          person={person}
          enableOutreach={enableOutreach}
          hasDraft={hasDraft}
          isDrafting={isDrafting}
          onDraftOutreach={onDraftOutreach}
        />
      </div>
    </article>
  );
};
