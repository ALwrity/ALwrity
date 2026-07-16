/**
 * F5 — Publish Now Modal
 *
 * Extracted from PublishWedgeModals.tsx (file > 500 lines) for maintainability.
 * Phase 1 adds publish media attachment UI (backend wiring in Phase 3).
 */

import React, { useState, useEffect, useRef } from 'react';
import { DashboardActionModal } from './DashboardActionModal';
import { publishLinkedInPost } from '../../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';
import { formatDraftForPublish } from '../../utils/linkedInPublishFormatters';
import { LINKEDIN_PUBLISH_MEDIA_ENABLED } from '../../utils/linkedInPublishMediaConstants';
import { useLinkedInPublishMedia } from '../../hooks/useLinkedInPublishMedia';
import { LinkedInPublishMediaSection } from '../LinkedInPublishMediaSection';

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

export const PublishNowModal: React.FC<PublishNowModalProps> = ({ open, onClose }) => {
  const { connected, accountName } = useLinkedInSocialConnection();
  const [rawDraft, setRawDraft] = useState('');
  const [content, setContent] = useState('');
  const [phase, setPhase] = useState<'preflight' | 'published'>('preflight');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [postResult, setPostResult] = useState<{ urn: string; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const publishMedia = useLinkedInPublishMedia({
    draft: rawDraft,
    autoDetectFromDraft: LINKEDIN_PUBLISH_MEDIA_ENABLED,
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

  const charCount = content.length;
  const charOk = charCount > 0 && charCount <= 3000;

  const handlePublish = async () => {
    if (!connected) {
      setError('LinkedIn is not connected. Please connect your account first.');
      return;
    }
    if (!charOk) {
      setError(charCount === 0 ? 'Post content cannot be empty.' : "Post exceeds LinkedIn's 3000 character limit.");
      return;
    }
    setPublishing(true);
    publishMedia.beginPublishing();
    setError('');
    abortRef.current = new AbortController();
    try {
      const publishContent = formatDraftForPublish(content);
      const result = await publishLinkedInPost({ content: publishContent });
      const suffix =
        publishMedia.hasAttachment && LINKEDIN_PUBLISH_MEDIA_ENABLED
          ? ' (text published; image attachment ships in Phase 3)'
          : '';
      setPostResult({
        urn: result.post_urn ?? result.post_id ?? 'published',
        message: (result.message || 'Published successfully.') + suffix,
      });
      setPhase('published');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Publishing failed. Please try again.';
      setError(msg);
    } finally {
      setPublishing(false);
      publishMedia.endPublishing();
    }
  };

  if (phase === 'published' && postResult) {
    return (
      <DashboardActionModal open={open} title="Post Published!" onClose={onClose} maxWidth={440}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>
            Successfully published to LinkedIn!
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            {postResult.message}
          </div>
          {postResult.urn && postResult.urn !== 'published' && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
              Post URN:{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                {postResult.urn}
              </code>
            </div>
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
      maxHeight="min(92vh, 700px)"
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

          <PreflightRow
            icon={charOk ? '🟢' : charCount === 0 ? '⚪' : '🔴'}
            label="Character count"
            value={`${charCount} / 3000 chars${!charOk && charCount > 3000 ? ' — exceeds limit' : ''}`}
            ok={charOk}
          />

          {LINKEDIN_PUBLISH_MEDIA_ENABLED && (
            <PreflightRow
              icon={publishMedia.hasAttachment ? '🟢' : '🟡'}
              label="Post image"
              value={
                publishMedia.hasAttachment
                  ? publishMedia.attachment?.source === 'ai'
                    ? 'AI-generated image attached'
                    : `Uploaded: ${publishMedia.attachment?.source === 'upload' ? publishMedia.attachment.fileName : ''}`
                  : 'Optional — generate with AI or upload from your device'
              }
              ok={publishMedia.hasAttachment ? true : null}
            />
          )}

          <PreflightRow
            icon="🟡"
            label="Duplicate detection"
            value="Content will be checked against your last 30 published posts on confirm"
            ok={null}
          />
        </div>

        {LINKEDIN_PUBLISH_MEDIA_ENABLED && (
          <div style={{ marginBottom: 16 }}>
            <LinkedInPublishMediaSection draft={rawDraft} media={publishMedia} />
          </div>
        )}

        <div style={sectionLabel}>Post content</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write or paste your LinkedIn post here…"
          rows={7}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: `1.5px solid ${!charOk && charCount > 0 ? (charCount > 3000 ? '#ef4444' : '#d1d5db') : '#d1d5db'}`,
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
            justifyContent: 'flex-end',
            fontSize: 11,
            color: charCount > 3000 ? '#ef4444' : '#9ca3af',
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          {charCount} / 3000
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
            style={panelBtn(true, false)}
            onClick={handlePublish}
            disabled={publishing || !connected || !charOk}
          >
            {publishing ? (
              <>
                <Spinner /> Publishing…
              </>
            ) : (
              `🚀 Confirm & Publish${publishMedia.hasAttachment && LINKEDIN_PUBLISH_MEDIA_ENABLED ? ' (text + image)' : ''}`
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
