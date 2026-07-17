import React, { useMemo } from 'react';
import { formatDraftContent } from '../utils/contentFormatters';
import { splitDraftByImageMarkdown } from '../utils/linkedInImageDraftUtils';
import { LinkedInAuthenticatedImage } from './LinkedInAuthenticatedImage';

interface LinkedInDraftPreviewProps {
  draft: string;
  citations?: any[];
  researchSources?: any[];
}

/**
 * Renders LinkedIn draft preview with authenticated image support.
 */
export const LinkedInDraftPreview: React.FC<LinkedInDraftPreviewProps> = ({
  draft,
  citations,
  researchSources,
}) => {
  const segments = useMemo(() => splitDraftByImageMarkdown(draft), [draft]);

  return (
    <div style={{ userSelect: 'text' }}>
      {segments.map((segment, index) => {
        if (segment.type === 'image') {
          if (segment.imageId) {
            return (
              <LinkedInAuthenticatedImage
                key={`image-${segment.imageId}-${index}`}
                imageId={segment.imageId}
                alt={segment.alt}
              />
            );
          }

          return (
            <img
              key={`image-url-${index}`}
              src={segment.url}
              alt={segment.alt}
              style={{
                maxWidth: '100%',
                maxHeight: 480,
                borderRadius: 8,
                margin: '12px 0',
                display: 'block',
                border: '1px solid #e0e0e0',
              }}
            />
          );
        }

        if (!segment.content.trim()) return null;

        const html = formatDraftContent(segment.content, citations, researchSources);
        if (!html?.trim()) return null;

        return (
          <div
            key={`text-${index}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};
