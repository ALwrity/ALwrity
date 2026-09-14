/**
 * Numbered Plan card chrome — idea (1) and basic setup (2). Hub red, not Podcast purple.
 */

import React from "react";
import "./youtubePlanLayout.css";

export interface YouTubePlanPaneCardProps {
  step: 1 | 2;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  children: React.ReactNode;
}

export const YouTubePlanPaneCard: React.FC<YouTubePlanPaneCardProps> = ({
  step,
  title,
  subtitle,
  ariaLabel,
  children,
}) => {
  return (
    <section className="yt-plan-pane" aria-label={ariaLabel}>
      <header className="yt-plan-pane__header">
        <span className="yt-plan-pane__step" aria-label={`Step ${step}`}>
          {step}
        </span>
        <div className="yt-plan-pane__titles">
          <h3 className="yt-plan-pane__title">{title}</h3>
          {subtitle ? <p className="yt-plan-pane__sub">{subtitle}</p> : null}
        </div>
      </header>
      <div className="yt-plan-pane__body">{children}</div>
    </section>
  );
};
