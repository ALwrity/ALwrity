// Hook for managing scene media (images and audio)
import { useState, useEffect } from 'react';
import { appendAuthTokenToUrl, fetchMediaBlobUrl } from '../../../utils/fetchMediaBlobUrl';

interface UseSceneMediaProps {
  imageUrl?: string | null;
  audioUrl?: string | null;
}

export const useSceneMedia = ({ imageUrl, audioUrl }: UseSceneMediaProps) => {
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  // Images: use ?token= query parameter so <img> tags load without blob lifecycle
  useEffect(() => {
    if (!imageUrl) {
      setImageBlobUrl(null);
      return;
    }

    let isMounted = true;
    setImageLoading(true);

    appendAuthTokenToUrl(imageUrl.split('?')[0])
      .then((authenticatedUrl) => {
        if (isMounted) {
          setImageBlobUrl(authenticatedUrl);
          setImageLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useSceneMedia] Failed to build authenticated image URL:', err);
        if (isMounted) {
          setImageBlobUrl(imageUrl);
          setImageLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  // Audio: keep blob approach — <audio> element holds the reference until unmount
  useEffect(() => {
    if (!audioUrl) {
      setAudioBlobUrl(null);
      return;
    }

    let isMounted = true;
    setAudioLoading(true);

    fetchMediaBlobUrl(audioUrl)
      .then((blobUrl) => {
        if (isMounted) {
          setAudioBlobUrl(blobUrl);
          setAudioLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useSceneMedia] Failed to load audio blob:', err);
        if (isMounted) setAudioLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [audioUrl]);

  return {
    imageBlobUrl,
    imageLoading,
    audioBlobUrl,
    audioLoading,
  };
};
