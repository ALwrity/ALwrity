/**
 * F5 — Publish Now Modal
 *
 * Extracted from PublishWedgeModals.tsx (file > 500 lines) for maintainability.
 * Phase 3: Best Practices checklist via LinkedInPublishChecklist (hard + soft).
 */

import React, { useState, useEffect, useRef } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { getLinkedInPublishErrorMessage } from '../../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { formatDraftForPublish } from '../../utils/linkedInPublishFormatters';
import { useLinkedInPublishMedia } from '../../hooks/useLinkedInPublishMedia';
import { LinkedInPublishMediaSection } from '../LinkedInPublishMediaSection';
import { LinkedInPublishPreviewPlain } from '../LinkedInPublishPreviewPlain';
import { LinkedInPublishChecklist } from '../LinkedInPublishChecklist';
import {
  buildLinkedInPublishSuccessMessage,
  getLinkedInPublishConfirmLabel,
  publishLinkedInWithMedia,
} from '../../utils/linkedInPublishHandler';
import {
  getLastDraftImageForPublish,
  resolvePublishMediaAttachment,
} from '../../utils/linkedInPublishMediaUtils';
import { LINKEDIN_POST_HARD_LIMIT } from '../../utils/linkedInPostFormatConstants';
import {
  areHardPublishChecksOk,
  assertHardPublishLimits,
  formatCharCountLabel,
  getCharReadiness,
  getPublishPlainText,
  getSeeMoreCaption,
} from '../../utils/linkedInPublishReadiness';

const DRAFT_STORAGE_KEY = 'alwrity-copilot-draft-content';

function readDraftFromStorage(): string {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

const panelBtn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 18px',
  borderRadius: 8,
  border: primary ? 'none' : '1.5px solid #d1d5db',
  background: danger ? '#ef4444' : primary ? '#0a66c2' : '#ffffff',
  color: danger ? '#fff' : primary ? '#fff' : '#374151',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 140ms',
});

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 6,
};

const Spinner = () => (
  <>
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </>
);

interface PreflightRowProps {
  icon: string;
  label: string;
  value: string;
  ok: boolean | null;
}

const PreflightRow: React.FC<PreflightRowProps> = ({ icon, label, value, ok }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '9px 12px',
      background: ok === true ? '#f0fdf4' : ok === false ? '#fef2f2' : '#fffbeb',
      borderRadius: 8,
      border: `1px solid ${ok === true ? '#bbf7d0' : ok === false ? '#fecaca' : '#fde68a'}`,
    }}
  >
    <span style={{ fontSize: 14, lineHeight: '20px', flexShrink: 0 }}>{icon}</span>
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1, lineHeight: 1.4 }}>{value}</div>
    </div>
  </div>
);

export interface PublishNowModalProps {
  open: boolean;
  onClose: () => void;
}

interface PublishResultState {
  urn: string;
  message: string;
  shareUrl?: string | null;
  hasMedia?: boolean;
}

export const PublishNowModal: React.FC<PublishNowModalProps> = ({ open, onClose }) => {
  const { connected, accountName, selectedAccountId } = useLinkedInSocialConnection();
  const [rawDraft, setRawDraft] = useState('');
  const [content, setContent] = useState('');
  const [phase, setPhase] = useState<'preflight' | 'published'>('preflight');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [postResult, setPostResult] = useState<PublishResultState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const publishMedia = useLinkedInPublishMedia({
    draft: rawDraft,
    autoDetectFromDraft: true,
  });

  useEffect(() => {
    if (open) {
      const stored = readDraftFromStorage();
      setRawDraft(stored);
      setContent(formatDraftForPublish(stored));
      setPhase('preflight');
      setError('');
      setPostResult(null);
      setPublishing(false);
      publishMedia.reset();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset media only when modal opens
  }, [open]);

  const chars = getCharReadiness(content);
  const seeMoreCaption = getSeeMoreCaption(chars);
  const draftHasImage = Boolean(getLastDraftImageForPublish(rawDraft));
  const hasPublishMedia = publishMedia.hasAttachment || draftHasImage;
  const previewAttachment = resolvePublishMediaAttachment(rawDraft, publishMedia.attachment);
  const hardChecksOk = areHardPublishChecksOk(content);
  const canConfirm = connected && hardChecksOk && !publishing;

  const handlePublish = async () => {
    if (!connected) {
      setError('LinkedIn is not connected. Please connect your account first.');
      return;
    }

    const publishContent = getPublishPlainText(content);
    const hardCheck = assertHardPublishLimits(publishContent);
    if (!hardCheck.ok) {
      setError(hardCheck.error || 'Cannot publish this post.');
      return;
    }

    setPublishing(true);
    publishMedia.beginPublishing();
    setError('');
    abortRef.current = new AbortController();
    try {
      const result = await publishLinkedInWithMedia({
        content: publishContent,
        accountId: selectedAccountId || undefined,
        draft: rawDraft,
        attachment: publishMedia.attachment,
      });
      setPostResult({
        urn: result.post_urn ?? result.post_id ?? 'published',
        message: buildLinkedInPublishSuccessMessage(result),
        shareUrl: result.share_url,
        hasMedia: result.has_media,
      });
      setPhase('published');
    } catch (err: unknown) {
      setError(getLinkedInPublishErrorMessage(err));
    } finally {
      setPublishing(false);
      publishMedia.endPublishing();
    }
  };

  if (phase === 'published' && postResult) {
    return (
      <DashboardActionModal open={open} title="Published!" onClose={onClose} maxWidth={440}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>
            Your post is live on LinkedIn
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            {postResult.message}
          </div>
          {postResult.hasMedia && (
            <div style={{ fontSize: 13, color: '#059669', marginBottom: 8 }}>
              Published with image
            </div>
          )}
          {postResult.shareUrl && (
            <div style={{ marginBottom: 16 }}>
              <a
                href={postResult.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#0a66c2', fontWeight: 600 }}
              >
                View on LinkedIn
              </a>
            </div>
          )}
          {postResult.urn && postResult.urn !== 'published' && (
            <details style={{ marginBottom: 16, textAlign: 'left' }}>
              <summary
                style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Technical details
              </summary>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                Post ID:{' '}
                <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                  {postResult.urn}
                </code>
              </div>
            </details>
          )}
          <button style={panelBtn(true)} onClick={onClose}>
            Done
          </button>
        </div>
      </DashboardActionModal>
    );
  }

  return (
    <DashboardActionModal
      open={open}
      title="Publish to LinkedIn"
      onClose={onClose}
      maxWidth={540}
      maxHeight="min(92vh, 760px)"
    >
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          <div style={sectionLabel}>Pre-flight checklist</div>

          <PreflightRow
            icon={connected ? '🟢' : '🔴'}
            label="LinkedIn connection"
            value={
              connected
                ? `Connected as ${accountName ?? 'your account'}`
                : 'Not connected — please connect in Settings'
            }
            ok={connected}
          />

          <LinkedInPublishChecklist draft={content} hasMedia={hasPublishMedia} />

          <PreflightRow
            icon="🟡"
            label="Duplicate detection"
            value="Content will be checked against your last 30 published posts on confirm"
            ok={null}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <LinkedInPublishMediaSection draft={rawDraft} media={publishMedia} />
        </div>

        <div style={sectionLabel}>Post content</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write or paste your LinkedIn post here…"
          rows={6}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1.5px solid ${
              !chars.hardOk && chars.count > 0
                ? chars.count > LINKEDIN_POST_HARD_LIMIT
                  ? '#ef4444'
                  : '#d1d5db'
                : '#d1d5db'
            }`,
            fontSize: 13,
            lineHeight: 1.6,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            color: '#111827',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: chars.count > LINKEDIN_POST_HARD_LIMIT ? '#ef4444' : '#9ca3af',
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          <span>{seeMoreCaption || ''}</span>
          <span>{formatCharCountLabel(chars.count)}</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <LinkedInPublishPreviewPlain
            draft={rawDraft}
            plainText={content}
            attachment={previewAttachment}
          />
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fef2f2',
              borderRadius: 7,
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{
              ...panelBtn(true, false),
              opacity: canConfirm ? 1 : 0.55,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
            onClick={handlePublish}
            disabled={!canConfirm}
          >
            {publishing ? (
              <>
                <Spinner />{' '}
                {hasPublishMedia ? 'Publishing text + image…' : 'Publishing…'}
              </>
            ) : (
              getLinkedInPublishConfirmLabel(hasPublishMedia)
            )}
          </button>
          <button style={panelBtn()} onClick={onClose}>
            Cancel
          </button>
        </div>

        {!connected && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            Connect your LinkedIn account in <strong>Settings → Integrations</strong> to enable
            publishing.
          </div>
        )}
      </div>
    </DashboardActionModal>
  );
};
