import React, { useMemo } from 'react';
import { LinkedIn as LinkedInIcon } from '@mui/icons-material';
import { getInitials } from '../utils/linkedInProfileSummary';
import { buildAvatarProxyUrl } from '../../../api/linkedinSocial';
import {
  deriveProfileHubAvatarShift,
  deriveProfileHubComboLayout,
} from '../hooks/profileHubStripSwipeUtils';
import { useProfileHubStripSwipe } from '../hooks/useProfileHubStripSwipe';

const AVATAR_SIZE = 48;
const STATUS_DOT_SIZE = 11;
const INLINE_AVATAR_SIZE = 44;

function getInlineSwipeHint(connected: boolean): string {
  return connected ? 'Swipe ← to unlink' : 'Swipe → to link';
}

export interface LinkedInProfileHubStripProps {
  connected: boolean;
  displayName?: string;
  avatarUrl?: string | null;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  /** Compact pill for the mobile workflow header row (≤960px). */
  variant?: 'default' | 'inline';
}

export const LinkedInProfileHubStrip: React.FC<LinkedInProfileHubStripProps> = ({
  connected,
  displayName = 'LinkedIn',
  avatarUrl,
  isConnecting = false,
  isDisconnecting = false,
  onConnect,
  onDisconnect,
  variant = 'default',
}) => {
  const initials = getInitials(displayName);
  const proxiedAvatarUrl = useMemo(() => buildAvatarProxyUrl(avatarUrl), [avatarUrl]);
  const statusLabel = connected ? 'Connected' : 'Not connected';
  const isInline = variant === 'inline';
  const isBusy = isConnecting || isDisconnecting;

  const { offsetX, swipeIntent, swipeHandlers } = useProfileHubStripSwipe({
    connected,
    onConnect,
    onDisconnect,
    isConnecting,
    isDisconnecting,
    enabled: isInline,
  });

  const comboLayout = isInline
    ? deriveProfileHubComboLayout(connected, offsetX, swipeIntent)
    : null;
  const avatarShift = comboLayout ? deriveProfileHubAvatarShift(offsetX, comboLayout) : 0;

  const swipeHint = isBusy
    ? connected
      ? 'Disconnecting…'
      : 'Connecting…'
    : getInlineSwipeHint(connected);

  const stripClassName = [
    'linkedin-profile-hub-strip',
    isInline && 'linkedin-profile-hub-strip--inline',
    swipeIntent === 'connect' && 'linkedin-profile-hub-strip--swipe-connect',
    swipeIntent === 'disconnect' && 'linkedin-profile-hub-strip--swipe-disconnect',
  ]
    .filter(Boolean)
    .join(' ');

  const renderAvatarCircle = (inlineInsideButton = false, shiftPx = 0) => (
    <div
      className={[
        'linkedin-profile-hub-strip-avatar-wrap',
        inlineInsideButton && 'linkedin-profile-hub-strip-avatar-wrap--in-btn',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        inlineInsideButton ? { transform: `translateX(${shiftPx}px)` } : undefined
      }
    >
      <div
        className={`linkedin-profile-hub-strip-avatar${
          connected ? ' linkedin-profile-hub-strip-avatar--connected' : ''
        }${inlineInsideButton ? ' linkedin-profile-hub-strip-avatar--in-btn' : ''}`}
        aria-hidden
      >
        {connected ? (
          avatarUrl ? (
            <img src={proxiedAvatarUrl ?? avatarUrl} alt="" />
          ) : (
            <span className="linkedin-profile-hub-strip-initials">{initials}</span>
          )
        ) : (
          <LinkedInIcon
            sx={{ color: '#0A66C2', fontSize: inlineInsideButton ? 32 : isInline ? 40 : 28 }}
          />
        )}
      </div>
      <span
        className={`linkedin-profile-status-dot linkedin-profile-status-dot--${
          connected ? 'connected' : 'disconnected'
        }`}
        aria-hidden
      />
    </div>
  );

  const renderComboLabel = (label: string) => (
    <span className="linkedin-profile-hub-strip-btn-label">{label}</span>
  );

  const renderComboContents = (label: string) => {
    const avatar = renderAvatarCircle(true, avatarShift);

    switch (comboLayout) {
      case 'connect-swipe':
        return (
          <>
            {renderComboLabel(label)}
            {avatar}
          </>
        );
      case 'disconnect-swipe':
        return (
          <>
            {avatar}
            {renderComboLabel(label)}
          </>
        );
      case 'connected-rest':
        return (
          <>
            {avatar}
            {renderComboLabel(label)}
          </>
        );
      default:
        return (
          <>
            {avatar}
            {renderComboLabel(label)}
          </>
        );
    }
  };

  const renderActionButton = (inlineCombo = false) => {
    const label = connected
      ? isDisconnecting
        ? 'Disconnecting…'
        : 'Disconnect'
      : isConnecting
        ? 'Connecting…'
        : 'Connect';

    if (inlineCombo) {
      return (
        <button
          type="button"
          className={[
            'linkedin-profile-hub-strip-btn',
            'linkedin-profile-hub-strip-btn--combo',
            connected
              ? 'linkedin-profile-hub-strip-btn--disconnect'
              : 'linkedin-profile-hub-strip-btn--connect',
            comboLayout === 'connect-swipe' && 'linkedin-profile-hub-strip-btn--combo-connect-swipe',
            comboLayout === 'disconnect-swipe' &&
              'linkedin-profile-hub-strip-btn--combo-disconnect-swipe',
            (comboLayout === 'connect-swipe' || comboLayout === 'disconnect-swipe') &&
              'linkedin-profile-hub-strip-btn--combo-spread',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={connected ? onDisconnect : onConnect}
          disabled={
            connected
              ? isDisconnecting || !onDisconnect
              : isConnecting || !onConnect
          }
          data-tour="li-connect-action"
          aria-label={
            isBusy
              ? label
              : connected
                ? 'Disconnect account. Swipe left to unlink.'
                : 'Connect account. Swipe right to link.'
          }
          {...swipeHandlers}
        >
          {renderComboContents(label)}
        </button>
      );
    }

    return connected ? (
      <button
        type="button"
        className="linkedin-profile-hub-strip-btn linkedin-profile-hub-strip-btn--disconnect"
        onClick={onDisconnect}
        disabled={isDisconnecting || !onDisconnect}
        aria-label={isDisconnecting ? 'Disconnecting account' : 'Disconnect account'}
      >
        {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
      </button>
    ) : (
      <button
        type="button"
        className="linkedin-profile-hub-strip-btn linkedin-profile-hub-strip-btn--connect"
        onClick={onConnect}
        disabled={isConnecting || !onConnect}
        data-tour="li-connect-action"
        aria-label={isConnecting ? 'Connecting account' : 'Connect account'}
      >
        {isConnecting ? 'Connecting…' : 'Connect'}
      </button>
    );
  };

  if (isInline) {
    return (
      <div className={stripClassName} data-tour="li-profile-hub">
        <span className="linkedin-profile-hub-strip-status-sr">{statusLabel}</span>
        <div className="linkedin-profile-hub-strip-action-col">
          <div className="linkedin-profile-hub-strip-action">{renderActionButton(true)}</div>
          <p className="linkedin-profile-hub-strip-swipe-hint" aria-hidden={isBusy}>
            {swipeHint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={stripClassName} data-tour="li-profile-hub">
      {renderAvatarCircle()}
      <div className="linkedin-profile-hub-strip-meta">
        <span className="linkedin-profile-hub-strip-name">{connected ? displayName : 'LinkedIn'}</span>
        <span
          className={`linkedin-profile-hub-strip-status linkedin-profile-hub-strip-status--${
            connected ? 'connected' : 'disconnected'
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="linkedin-profile-hub-strip-action">{renderActionButton()}</div>
    </div>
  );
};

export const PROFILE_HUB_STRIP_AVATAR_PX = AVATAR_SIZE;
export const PROFILE_HUB_STRIP_INLINE_AVATAR_PX = INLINE_AVATAR_SIZE;
export const PROFILE_HUB_STRIP_DOT_PX = STATUS_DOT_SIZE;
