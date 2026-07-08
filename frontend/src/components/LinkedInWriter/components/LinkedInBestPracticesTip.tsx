/**
 * LinkedInBestPracticesTip.tsx
 *
 * Lightweight, dismissible contextual tip panel for the dashboard right rail.
 * Surfaces one LinkedIn engagement best-practice at a time, rotating through
 * six tips compiled from the Issue #731 knowledge brief.
 *
 * Usage:
 *   <LinkedInBestPracticesTip />
 */

import React, { useCallback, useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BestPracticeTip {
  id: string;
  emoji: string;
  title: string;
  body: string;
}

// ── Tip Data (Issue #731) ─────────────────────────────────────────────────────

const TIPS: BestPracticeTip[] = [
  {
    id: 'hook-formula',
    emoji: '🪝',
    title: 'Hook Formula',
    body:
      'Your first 2 lines are your entire post from the feed preview. ' +
      'Start with a question, bold claim, or surprising statistic — never "I am excited to share…"',
  },
  {
    id: 'post-length',
    emoji: '📏',
    title: 'Post Length Sweet Spot',
    body:
      '150–300 words maximises algorithmic reach for feed posts. ' +
      'Going over 300 words without an article format leaves engagement on the table.',
  },
  {
    id: 'end-question',
    emoji: '💬',
    title: 'End with a Question',
    body:
      'Posts that close with a specific open question drive ~3× more comments — ' +
      'and comments are the strongest signal LinkedIn uses to boost reach.',
  },
  {
    id: 'article-structure',
    emoji: '📰',
    title: 'Article Structure',
    body:
      'Long-form articles need a benefit-driven headline and subheadings every ' +
      '200–300 words. Always close with a "Key Takeaways" section.',
  },
  {
    id: 'hashtag-rule',
    emoji: '#️⃣',
    title: 'Hashtag Rule',
    body:
      'Use a maximum of 3 hashtags per post. LinkedIn's algorithm treats more ' +
      'than 3 as a spam signal, actively reducing distribution.',
  },
  {
    id: 'network-participation',
    emoji: '🌐',
    title: 'Network Participation',
    body:
      'Commenting meaningfully on 5+ posts per day compounds your profile ' +
      'visibility faster than posting alone. Consistent engagement builds reach.',
  },
];

const STORAGE_KEY = 'alwrity_li_tip_dismissed';

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(10,102,194,0.12) 0%, rgba(0,0,0,0) 100%)',
  border: '1px solid rgba(10,102,194,0.30)',
  borderRadius: 12,
  padding: '14px 16px',
  position: 'relative',
  marginBottom: 12,
  transition: 'opacity 0.25s ease',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginBottom: 6,
};

const emojiStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
  flexShrink: 0,
  marginTop: 1,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.92)',
  letterSpacing: 0.2,
  flex: 1,
};

const bodyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
  lineHeight: 1.55,
  marginLeft: 26, // indent under emoji
};

const dismissButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.35)',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: '0 2px',
  transition: 'color 0.15s ease',
};

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  marginTop: 10,
  marginLeft: 26,
};

const navDotStyle = (active: boolean): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: active ? 'rgba(10,102,194,0.9)' : 'rgba(255,255,255,0.2)',
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  transition: 'background 0.2s ease',
});

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginRight: 'auto',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const LinkedInBestPracticesTip: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    // Rotate tip index daily so users see a fresh tip each session
    return Math.floor(Date.now() / 86_400_000) % TIPS.length;
  });

  // If the user has already dismissed, skip rendering entirely
  if (dismissed) return null;

  const tip = TIPS[currentIndex];

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    setDismissed(true);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % TIPS.length);
  }, []);

  const handleDotClick = useCallback((idx: number) => {
    setCurrentIndex(idx);
  }, []);

  return (
    <div style={panelStyle} role="complementary" aria-label="LinkedIn best practice tip">
      {/* Dismiss button */}
      <button
        id="li-best-practice-tip-dismiss"
        style={dismissButtonStyle}
        onClick={handleDismiss}
        aria-label="Dismiss LinkedIn tip"
        title="Dismiss"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
        }}
      >
        ✕
      </button>

      {/* Header */}
      <div style={headerStyle}>
        <span style={emojiStyle} aria-hidden="true">
          {tip.emoji}
        </span>
        <span style={titleStyle}>{tip.title}</span>
      </div>

      {/* Body */}
      <p style={bodyStyle}>{tip.body}</p>

      {/* Navigation row */}
      <div style={navRowStyle}>
        <span style={labelStyle}>Tip {currentIndex + 1}/{TIPS.length}</span>
        {TIPS.map((t, idx) => (
          <button
            key={t.id}
            id={`li-tip-dot-${idx}`}
            style={navDotStyle(idx === currentIndex)}
            onClick={() => handleDotClick(idx)}
            aria-label={`Show tip ${idx + 1}: ${t.title}`}
            aria-current={idx === currentIndex ? 'true' : undefined}
          />
        ))}
        <button
          id="li-best-practice-tip-next"
          style={{
            ...dismissButtonStyle,
            position: 'static',
            color: 'rgba(10,102,194,0.8)',
            fontSize: 12,
            fontWeight: 600,
            marginLeft: 4,
          }}
          onClick={handleNext}
          aria-label="Next LinkedIn tip"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default LinkedInBestPracticesTip;
