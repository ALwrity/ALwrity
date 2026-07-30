import React from 'react';
import { ConnectLockBadge } from '../dashboard/ConnectLockIcon';

interface PlanWedgeComingSoonCardProps {
  icon: string;
  iconVariant: "watchdog" | "weekly" | "calendar" | "carousel" | "video_script";
  title: string;
  description: string;
  notified: boolean;
  onNotify: () => void;
  /** Hide the purple "Coming Soon" pill (Create wedge locked tiles). */
  showComingSoonBadge?: boolean;
}

export const PlanWedgeComingSoonCard: React.FC<PlanWedgeComingSoonCardProps> = ({
  icon,
  iconVariant,
  title,
  description,
  notified,
  onNotify,
  showComingSoonBadge = true,
}) => (
  <div
    className="plan-wedge-coming-soon-card linkedin-studio-connect-locked plan-wedge-coming-soon-card--locked"
    aria-disabled
  >
    <div className="plan-wedge-coming-soon-card__header">
      <span
        className={`plan-wedge-coming-soon-card__icon plan-wedge-coming-soon-card__icon--${iconVariant}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="plan-wedge-coming-soon-card__header-badges">
        {showComingSoonBadge && (
          <span className="plan-wedge-coming-soon-card__badge">Coming Soon</span>
        )}
        <ConnectLockBadge size={10} className="plan-wedge-coming-soon-card__lock" />
      </div>
    </div>
    <div className="plan-wedge-coming-soon-card__copy">
      <span className="plan-wedge-coming-soon-card__title">{title}</span>
      <p className="plan-wedge-coming-soon-card__desc">{description}</p>
    </div>
    <button
      type="button"
      className={`plan-wedge-coming-soon-card__notify${notified ? ' plan-wedge-coming-soon-card__notify--done' : ''}`}
      onClick={onNotify}
      disabled={notified}
      aria-label={notified ? `${title} — notification requested` : `Notify me when ${title} launches`}
    >
      {notified ? 'Notified' : 'Notify me'}
    </button>
  </div>
);

export default PlanWedgeComingSoonCard;
