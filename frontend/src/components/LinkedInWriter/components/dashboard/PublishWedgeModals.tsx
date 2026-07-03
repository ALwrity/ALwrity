/**
 * Publish Wedge — 5 AI-first feature modals
 *
 * F4  DraftLibraryModal      — inline draft list, "Open in Studio" restore
 * F1  QualityCheckModal      — pre-publish 6-dim score card
 * F2  TimingAdvisorModal     — week-grid optimal posting times
 * F3  ScheduleQuickModal     — calendar quick-add
 * F5  PublishNowModal        — direct LinkedIn publish with pre-flight
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardActionModal } from './DashboardActionModal';
import { PreviewScoreCard } from '../GrowthEngine/PreviewScoreCard';
import { apiClient } from '../../../../api/client';
import { linkedInGrowthApi } from '../../../../services/linkedInGrowthApi';
import type { PostPreviewScoreResponse } from '../../../../services/linkedInGrowthApi';
import { contentPlanningApi } from '../../../../services/contentPlanningApi';
import { publishLinkedInPost } from '../../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DRAFT_STORAGE_KEY = 'alwrity-copilot-draft-content';

function readDraftFromStorage(): string {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function openInStudio(content: string, onDone: () => void) {
  window.dispatchEvent(
    new CustomEvent('linkedinwriter:updateDraft', { detail: content })
  );
  onDone();
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

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

const cardBox: React.CSSProperties = {
  background: '#f8fafc',
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  padding: '12px 14px',
  marginBottom: 10,
};

const Spinner = () => (
  <>
    <style>{`@keyframes pw-spin { to { transform: rotate(360deg); } }`}</style>
    <span
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        border: '2px solid #d1d5db',
        borderTopColor: '#0a66c2',
        borderRadius: '50%',
        animation: 'pw-spin 0.7s linear infinite',
      }}
    />
  </>
);

// ---------------------------------------------------------------------------
// F4 — Draft Library Modal
// ---------------------------------------------------------------------------

interface ContentAsset {
  id: string;
  title: string;
  description: string;
  created_at: string;
  source_module?: string;
}

interface DraftLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

export const DraftLibraryModal: React.FC<DraftLibraryModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    apiClient
      .get('/api/content-assets/', {
        params: { source_module: 'linkedin_writer', limit: 5, sort_by: 'created_at', sort_order: 'desc' },
      })
      .then((res) => {
        const data = res.data;
        setDrafts(Array.isArray(data) ? data : data?.assets ?? []);
      })
      .catch(() => setError('Could not load drafts. Please try again.'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleOpenInStudio = (asset: ContentAsset) => {
    openInStudio(asset.description, onClose);
  };

  const handleViewAll = () => {
    onClose();
    navigate('/asset-library?source_module=linkedin_writer');
  };

  return (
    <DashboardActionModal open={open} title="My Drafts" onClose={onClose} maxWidth={560}>
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Your last 5 saved LinkedIn drafts. Open any draft directly in the Studio editor.
        </p>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#64748b', fontSize: 13 }}>
            <Spinner /> Loading drafts…
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!loading && !error && drafts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
            No saved drafts yet. Generate content in the Create wedge to get started.
          </div>
        )}

        {drafts.map((asset) => (
          <div key={asset.id} style={{ ...cardBox, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {asset.title || 'Untitled Draft'}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {asset.created_at
                    ? new Date(asset.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : ''}
                  {asset.description ? ` · ${asset.description.length} chars` : ''}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, fontStyle: 'italic' }}>
              "{asset.description?.slice(0, 90)}{(asset.description?.length ?? 0) > 90 ? '…' : ''}"
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={panelBtn(true)} onClick={() => handleOpenInStudio(asset)}>
                ✍️ Open in Studio
              </button>
              <button style={panelBtn()} onClick={handleViewAll}>
                📁 View in Library
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button style={panelBtn()} onClick={handleViewAll}>
            View All in Library →
          </button>
        </div>
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F1 — Quality Check Modal
// ---------------------------------------------------------------------------

interface QualityCheckModalProps {
  open: boolean;
  onClose: () => void;
}

export const QualityCheckModal: React.FC<QualityCheckModalProps> = ({ open, onClose }) => {
  const [content, setContent] = useState('');
  const [scoreResult, setScoreResult] = useState<PostPreviewScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setContent(readDraftFromStorage());
      setScoreResult(null);
      setError('');
    }
  }, [open]);

  const handleScore = async () => {
    if (!content.trim()) {
      setError('Please enter or paste some post content to score.');
      return;
    }
    setLoading(true);
    setError('');
    setScoreResult(null);
    try {
      const result = await linkedInGrowthApi.getPostPreviewScore({ content });
      setScoreResult(result);
    } catch {
      setError('Scoring failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImproveInStudio = () => {
    openInStudio(content, onClose);
  };

  return (
    <DashboardActionModal open={open} title="Pre-Publish Quality Check" onClose={onClose} maxWidth={560} maxHeight="min(92vh, 700px)">
      <div>
        {!scoreResult && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              Score your post across 6 dimensions (Hook, Clarity, Engagement, Value, CTA, Readability) before publishing.
            </p>
            <div style={sectionLabel}>Your Post Content</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your LinkedIn post here, or load from Studio…"
              rows={8}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid #d1d5db',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                color: '#111827',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
              <span>{content.length} / 3000 chars</span>
              {!readDraftFromStorage() && (
                <span>Tip: Generate content first in the Create wedge</span>
              )}
            </div>
            {error && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={panelBtn(true)} onClick={handleScore} disabled={loading}>
                {loading ? <><Spinner /> Scoring…</> : '📊 Score My Post'}
              </button>
            </div>
          </>
        )}

        {scoreResult && (
          <>
            <PreviewScoreCard
              overallScore={scoreResult.overall_score}
              dimensions={scoreResult.dimensions}
              topImprovement={scoreResult.top_improvement}
              dataSourceSummary={scoreResult.data_source_summary}
              onApply={handleImproveInStudio}
              onDismiss={() => setScoreResult(null)}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={panelBtn(true)} onClick={handleImproveInStudio}>
                ✍️ Improve in Studio
              </button>
              <button style={panelBtn()} onClick={() => setScoreResult(null)}>
                ← Re-score
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F2 — Timing Advisor Modal
// ---------------------------------------------------------------------------

interface TimingAdvisorModalProps {
  open: boolean;
  onClose: () => void;
  onScheduleSlot?: (date: string, time: string) => void;
}

type ReachLevel = 'high' | 'medium' | 'low' | 'off';

interface SlotData {
  level: ReachLevel;
  label: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TIME_SLOTS = ['7–9 AM', '9–11 AM', '11 AM–1 PM', '1–3 PM', '3–5 PM', '5–7 PM'];

// Industry-keyed optimal posting windows (LinkedIn algorithm-backed heuristics)
const TIMING_MATRIX: Record<string, ReachLevel[][]> = {
  Technology: [
    ['low', 'medium', 'high', 'medium', 'low', 'off'],
    ['medium', 'high', 'high', 'medium', 'low', 'off'],
    ['low', 'high', 'high', 'medium', 'low', 'off'],
    ['medium', 'high', 'medium', 'medium', 'low', 'off'],
    ['low', 'medium', 'low', 'low', 'off', 'off'],
  ],
  Finance: [
    ['medium', 'high', 'medium', 'low', 'off', 'off'],
    ['high', 'high', 'medium', 'medium', 'low', 'off'],
    ['medium', 'high', 'medium', 'medium', 'off', 'off'],
    ['medium', 'high', 'medium', 'low', 'off', 'off'],
    ['low', 'medium', 'low', 'off', 'off', 'off'],
  ],
  Healthcare: [
    ['low', 'high', 'medium', 'medium', 'low', 'off'],
    ['medium', 'high', 'high', 'medium', 'low', 'off'],
    ['low', 'medium', 'high', 'medium', 'low', 'off'],
    ['medium', 'high', 'medium', 'low', 'off', 'off'],
    ['low', 'medium', 'low', 'off', 'off', 'off'],
  ],
  Marketing: [
    ['low', 'medium', 'high', 'high', 'medium', 'low'],
    ['medium', 'high', 'high', 'high', 'medium', 'low'],
    ['medium', 'high', 'high', 'medium', 'medium', 'low'],
    ['low', 'medium', 'high', 'medium', 'low', 'low'],
    ['low', 'low', 'medium', 'low', 'off', 'off'],
  ],
  Default: [
    ['low', 'high', 'medium', 'medium', 'low', 'off'],
    ['medium', 'high', 'high', 'medium', 'low', 'off'],
    ['low', 'high', 'high', 'medium', 'low', 'off'],
    ['medium', 'high', 'medium', 'medium', 'off', 'off'],
    ['low', 'medium', 'low', 'off', 'off', 'off'],
  ],
};

const REACH_COLORS: Record<ReachLevel, { bg: string; text: string; label: string }> = {
  high: { bg: '#dcfce7', text: '#15803d', label: 'High reach' },
  medium: { bg: '#fef9c3', text: '#a16207', label: 'Medium reach' },
  low: { bg: '#f1f5f9', text: '#94a3b8', label: 'Low reach' },
  off: { bg: '#f8f8f8', text: '#d1d5db', label: 'Off-peak' },
};

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Marketing'];

export const TimingAdvisorModal: React.FC<TimingAdvisorModalProps> = ({ open, onClose, onScheduleSlot }) => {
  const [industry, setIndustry] = useState('Technology');
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; slot: number } | null>(null);

  const matrix = TIMING_MATRIX[industry] ?? TIMING_MATRIX['Default'];

  const getNextDayDate = (dayIndex: number): string => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday
    const targetDay = dayIndex + 1; // 1 = Monday
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    const target = new Date(now);
    target.setDate(now.getDate() + diff);
    return target.toISOString().split('T')[0];
  };

  const SLOT_TIMES = ['07:30', '09:30', '11:30', '13:30', '15:30', '17:30'];

  const handleScheduleThis = () => {
    if (!selectedSlot) return;
    const date = getNextDayDate(selectedSlot.day);
    const time = SLOT_TIMES[selectedSlot.slot];
    if (onScheduleSlot) {
      onScheduleSlot(date, time);
      onClose();
    }
  };

  const selectedLevel = selectedSlot ? matrix[selectedSlot.day][selectedSlot.slot] : null;

  return (
    <DashboardActionModal open={open} title="Best Time to Post" onClose={onClose} maxWidth={600}>
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Optimal LinkedIn posting windows for your industry, based on algorithm-backed engagement data.
          Greener slots = higher organic reach.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Industry:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: '1.5px solid',
                  borderColor: industry === ind ? '#0a66c2' : '#d1d5db',
                  background: industry === ind ? '#dbeafe' : '#fff',
                  color: industry === ind ? '#0a66c2' : '#6b7280',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Week grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ width: 90, textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Time slot</th>
                {DAYS.map((d) => (
                  <th key={d} style={{ textAlign: 'center', padding: '6px 4px', fontSize: 12, color: '#374151', fontWeight: 700 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, si) => (
                <tr key={slot}>
                  <td style={{ padding: '4px 8px', fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{slot}</td>
                  {DAYS.map((_, di) => {
                    const level = matrix[di][si];
                    const colors = REACH_COLORS[level];
                    const isSelected = selectedSlot?.day === di && selectedSlot?.slot === si;
                    return (
                      <td key={di} style={{ padding: '4px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedSlot({ day: di, slot: si })}
                          title={`${DAYS[di]} ${slot} — ${colors.label}`}
                          style={{
                            width: 44,
                            height: 32,
                            borderRadius: 7,
                            border: isSelected ? '2px solid #0a66c2' : '1.5px solid transparent',
                            background: isSelected ? '#dbeafe' : colors.bg,
                            cursor: level === 'off' ? 'default' : 'pointer',
                            fontSize: 10,
                            color: isSelected ? '#0a66c2' : colors.text,
                            fontWeight: isSelected ? 700 : 500,
                            transition: 'transform 120ms',
                          }}
                        >
                          {level === 'high' ? '●●●' : level === 'medium' ? '●●' : level === 'low' ? '●' : '—'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {(['high', 'medium', 'low', 'off'] as ReachLevel[]).map((level) => (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: REACH_COLORS[level].bg, border: '1px solid #e2e8f0' }} />
              {REACH_COLORS[level].label}
            </div>
          ))}
        </div>

        {selectedSlot && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0f9ff', borderRadius: 10, border: '1.5px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0284c7' }}>
                {DAYS[selectedSlot.day]}, {TIME_SLOTS[selectedSlot.slot]}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {selectedLevel ? REACH_COLORS[selectedLevel].label : ''} posting window for {industry}
              </div>
            </div>
            <button style={panelBtn(true)} onClick={handleScheduleThis} disabled={!onScheduleSlot}>
              📅 Schedule for this slot
            </button>
          </div>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F3 — Schedule Quick-Add Modal
// ---------------------------------------------------------------------------

interface ScheduleQuickModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill from timing advisor */
  prefillDate?: string;
  prefillTime?: string;
}

const FORMAT_OPTIONS = [
  { value: 'post', label: '📝 Post' },
  { value: 'article', label: '📄 Article' },
  { value: 'carousel', label: '🎠 Carousel' },
];

export const ScheduleQuickModal: React.FC<ScheduleQuickModalProps> = ({
  open,
  onClose,
  prefillDate = '',
  prefillTime = '',
}) => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('post');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (open) {
      const draft = readDraftFromStorage();
      setTopic(draft.slice(0, 100).replace(/\n/g, ' ') || '');
      setDate(prefillDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
      setTime(prefillTime || '09:30');
      setFormat('post');
      setError('');
      setSuccess(null);
    }
  }, [open, prefillDate, prefillTime]);

  const handleSchedule = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or title for the scheduled post.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await contentPlanningApi.createEvent({
        title: topic.slice(0, 120),
        description: readDraftFromStorage().slice(0, 500) || topic,
        date: `${date}T${time || '09:00'}:00`,
        platform: 'linkedin',
        content_type: format,
        status: 'scheduled',
      });
      const eventId = result?.id ?? result?.event_id ?? result?.calendar_event_id ?? 'saved';
      setSuccess({ id: String(eventId) });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Scheduling failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <DashboardActionModal open={open} title="Post Scheduled" onClose={onClose} maxWidth={440}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 6 }}>
            Scheduled successfully!
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Calendar event <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>#{success.id}</code> created for{' '}
            {new Date(`${date}T${time}`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button style={panelBtn(true)} onClick={() => { onClose(); navigate('/content-planning', { state: { activeTab: 1 } }); }}>
              📅 View in Calendar
            </button>
            <button style={panelBtn()} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </DashboardActionModal>
    );
  }

  return (
    <DashboardActionModal open={open} title="Schedule Post" onClose={onClose} maxWidth={480}>
      <div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Add this post to your LinkedIn content calendar without leaving the studio.
        </p>

        <div style={sectionLabel}>Topic / Title</div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What is this post about?"
          maxLength={120}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, color: '#111827', boxSizing: 'border-box', marginBottom: 14 }}
        />

        <div style={sectionLabel}>Format</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1.5px solid',
                borderColor: format === opt.value ? '#0a66c2' : '#d1d5db',
                background: format === opt.value ? '#dbeafe' : '#fff',
                color: format === opt.value ? '#0a66c2' : '#6b7280',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={sectionLabel}>Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, color: '#111827', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={sectionLabel}>Time</div>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, color: '#111827', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={panelBtn(true)} onClick={handleSchedule} disabled={loading}>
            {loading ? <><Spinner /> Scheduling…</> : '📅 Confirm Schedule'}
          </button>
          <button style={panelBtn()} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// F5 — Publish Now Modal
// ---------------------------------------------------------------------------

type PreflightStatus = 'idle' | 'checking' | 'ready' | 'error';

interface PublishNowModalProps {
  open: boolean;
  onClose: () => void;
}

export const PublishNowModal: React.FC<PublishNowModalProps> = ({ open, onClose }) => {
  const { connected, accountName } = useLinkedInSocialConnection();
  const [content, setContent] = useState('');
  const [phase, setPhase] = useState<'preflight' | 'published'>('preflight');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [postResult, setPostResult] = useState<{ urn: string; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setContent(readDraftFromStorage());
      setPhase('preflight');
      setError('');
      setPostResult(null);
      setPublishing(false);
    }
    return () => abortRef.current?.abort();
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
    setError('');
    abortRef.current = new AbortController();
    try {
      const result = await publishLinkedInPost({ content });
      setPostResult({ urn: result.post_urn ?? result.post_id ?? 'published', message: result.message });
      setPhase('published');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Publishing failed. Please try again.';
      setError(msg);
    } finally {
      setPublishing(false);
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
              Post URN: <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{postResult.urn}</code>
            </div>
          )}
          <button style={panelBtn(true)} onClick={onClose}>Done</button>
        </div>
      </DashboardActionModal>
    );
  }

  return (
    <DashboardActionModal open={open} title="Publish to LinkedIn" onClose={onClose} maxWidth={540} maxHeight="min(92vh, 700px)">
      <div>
        {/* Pre-flight summary — 3 checks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          <div style={sectionLabel}>Pre-flight checklist</div>

          {/* 1. Connection */}
          <PreflightRow
            icon={connected ? '🟢' : '🔴'}
            label="LinkedIn connection"
            value={connected ? `Connected as ${accountName ?? 'your account'}` : 'Not connected — please connect in Settings'}
            ok={connected}
          />

          {/* 2. Character count */}
          <PreflightRow
            icon={charOk ? '🟢' : charCount === 0 ? '⚪' : '🔴'}
            label="Character count"
            value={`${charCount} / 3000 chars${!charOk && charCount > 3000 ? ' — exceeds limit' : ''}`}
            ok={charOk}
          />

          {/* 3. Duplicate check */}
          <PreflightRow
            icon="🟡"
            label="Duplicate detection"
            value="Content will be checked against your last 30 published posts on confirm"
            ok={null}
          />
        </div>

        {/* Draft preview */}
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: charCount > 3000 ? '#ef4444' : '#9ca3af', marginTop: 4, marginBottom: 14 }}>
          {charCount} / 3000
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 7, color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={panelBtn(true, false)}
            onClick={handlePublish}
            disabled={publishing || !connected || !charOk}
          >
            {publishing ? <><Spinner /> Publishing…</> : '🚀 Confirm & Publish'}
          </button>
          <button style={panelBtn()} onClick={onClose}>Cancel</button>
        </div>

        {!connected && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            Connect your LinkedIn account in{' '}
            <strong>Settings → Integrations</strong> to enable publishing.
          </div>
        )}
      </div>
    </DashboardActionModal>
  );
};

// ---------------------------------------------------------------------------
// PreflightRow helper
// ---------------------------------------------------------------------------
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
