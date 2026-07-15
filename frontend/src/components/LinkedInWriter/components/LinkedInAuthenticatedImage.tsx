import React, { useEffect, useState } from 'react';
import { fetchLinkedInImageBlobUrl } from '../../../services/linkedInImageService';

interface LinkedInAuthenticatedImageProps {
  imageId: string;
  alt?: string;
}

/**
 * Renders a LinkedIn stored image using an authenticated blob fetch.
 * Required because image endpoints are protected and cannot be used directly in <img src>.
 */
export const LinkedInAuthenticatedImage: React.FC<LinkedInAuthenticatedImageProps> = ({
  imageId,
  alt = 'Generated LinkedIn image',
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    const loadImage = async () => {
      try {
        blobUrl = await fetchLinkedInImageBlobUrl(imageId);
        if (!cancelled) {
          setSrc(blobUrl);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [imageId]);

  if (error) {
    return (
      <div
        style={{
          margin: '12px 0',
          padding: '12px',
          borderRadius: 8,
          border: '1px dashed #cbd5e1',
          color: '#64748b',
          fontSize: 14,
        }}
      >
        Generated image could not be loaded.
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{
          margin: '12px 0',
          padding: '12px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          color: '#64748b',
          fontSize: 14,
        }}
      >
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
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
};
