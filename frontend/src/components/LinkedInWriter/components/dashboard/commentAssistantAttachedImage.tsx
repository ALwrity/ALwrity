import React from 'react';
import { colors } from '../GrowthEngine/styles';

interface CommentAssistantAttachedImageProps {
  src: string;
  alt?: string;
}

/** Renders a comment/reply attachment image inside Comment Assistant. */
export const CommentAssistantAttachedImage: React.FC<CommentAssistantAttachedImageProps> = ({
  src,
  alt = 'Attached image',
}) => {
  if (!src) return null;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', marginTop: 6, marginBottom: 6, maxWidth: '100%' }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 360,
          maxHeight: 280,
          objectFit: 'contain',
          borderRadius: 6,
          border: `1px solid ${colors.border}`,
          background: '#f8fafc',
        }}
      />
    </a>
  );
};
