import type React from 'react';

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  marginBottom: 20,
  width: '100%',
  maxWidth: 1200,
  position: 'relative',
  padding: '10px 0',
};

const CARD_INNER_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '20px',
  padding: '24px 28px',
  boxShadow: `
    0 20px 60px rgba(0,0,0,0.15),
    0 8px 32px rgba(10, 102, 194, 0.1),
    inset 0 1px 0 rgba(255,255,255,0.2)
  `,
  position: 'relative',
  overflow: 'hidden',
  minHeight: 180,
};

export const linkedInPlaceholderCardStyles = {
  wrapper: CARD_WRAPPER_STYLE,
  inner: CARD_INNER_STYLE,
};
