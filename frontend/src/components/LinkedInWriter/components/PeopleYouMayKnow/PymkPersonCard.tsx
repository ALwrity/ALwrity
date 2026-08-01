import React, { useState, useEffect } from 'react';
import type { PymkSuggestionItem } from '../../../../services/linkedInPymkApi';
import { buildAuthenticatedImageUrl } from '../../../../services/linkedInPymkApi';
import { colors } from '../GrowthEngine/styles';

interface PymkPersonCardProps {
  person: PymkSuggestionItem;
}

export const PymkPersonCard: React.FC<PymkPersonCardProps> = ({ person }) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const initials = person.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const isPending = person.connection_state === 'invitation_pending';

  // Build direct authenticated image URLs with token from API client cache
  // Retry mechanism: re-build URLs when retryCount changes (triggered by interval)
  const photoUrl = buildAuthenticatedImageUrl(person.photo_url ?? '');
  const bgUrl = buildAuthenticatedImageUrl(person.background_url ?? '');

  // Retry building URLs a few times if token wasn't available initially
  useEffect(() => {
    if ((person.photo_url || person.background_url) && !photoUrl && !bgUrl && retryCount < 5) {
      const timer = setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, 500 * (retryCount + 1)); // Progressive backoff: 500ms, 1000ms, 1500ms...
      return () => clearTimeout(timer);
    }
  }, [person.photo_url, person.background_url, photoUrl, bgUrl, retryCount]);

  const showPhoto = Boolean(photoUrl) && !photoFailed;
  const showBackground = Boolean(bgUrl) && !bgFailed;

  // Log image loading issues for debugging
  const handlePhotoError = () => {
    console.warn('[PYMK] Failed to load profile photo:', {
      name: person.name,
      originalUrl: person.photo_url,
      proxyUrl: photoUrl?.slice(0, 100) + '...',
    });
    setPhotoFailed(true);
  };

  const handleBgError = () => {
    console.warn('[PYMK] Failed to load background image:', {
      name: person.name,
      originalUrl: person.background_url,
      proxyUrl: bgUrl?.slice(0, 100) + '...',
    });
    setBgFailed(true);
  };

  return (
    <article
      style={{
        border: '1px solid #d0d7de',
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 280,
      }}
    >
      <div
        style={{
          height: 56,
          background: showBackground
            ? `url(${bgUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
        }}
      >
        {showBackground && (
          <img
            src={bgUrl!}
            alt=""
            onError={handleBgError}
            style={{ display: 'none' }}
          />
        )}
      </div>

      <div style={{ marginTop: -36, padding: '0 16px', textAlign: 'center' }}>
        {showPhoto ? (
          <img
            src={photoUrl!}
            alt=""
            width={72}
            height={72}
            onError={handlePhotoError}
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #fff',
              background: '#fff',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              margin: '0 auto',
              borderRadius: '50%',
              background: '#e8f3ff',
              color: colors.primary,
              border: '2px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            {initials || '?'}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px 16px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <a
          href={person.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontWeight: 600,
            fontSize: 15,
            color: colors.textDark,
            textDecoration: 'none',
            lineHeight: 1.3,
          }}
        >
          {person.name}
        </a>

        {person.headline && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 12,
              color: colors.textMuted,
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 34,
            }}
          >
            {person.headline}
          </p>
        )}

        {person.mutual_connections_text && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: colors.textSecondary }}>
            {person.mutual_connections_text}
          </p>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Connect will be available in a future release"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 20,
              border: `1px solid ${colors.primary}`,
              background: '#fff',
              color: colors.primary,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'not-allowed',
              opacity: isPending ? 0.75 : 0.9,
            }}
          >
            {isPending ? 'Pending' : 'Connect'}
          </button>
        </div>
      </div>
    </article>
  );
};
