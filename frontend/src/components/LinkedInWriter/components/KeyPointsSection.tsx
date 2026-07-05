import React, { useState } from 'react';
import { generateKeyPoints, type KeyPointSet } from '../../../services/linkedInWriterApi';

interface KeyPointsSectionProps {
  topic: string;
  industry: string;
  tone: string;
  targetAudience: string;
  keyPoints: string;
  onChange: (value: string) => void;
}

export const KeyPointsSection: React.FC<KeyPointsSectionProps> = ({
  topic,
  industry,
  tone,
  targetAudience,
  keyPoints,
  onChange,
}) => {
  const [phase, setPhase] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [sets, setSets] = useState<KeyPointSet[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    console.log('[KeyPointsSection] handleGenerate called, topic:', JSON.stringify(topic), 'trimmed:', JSON.stringify(topic.trim()));
    setErrorMsg(null);
    setPhase('generating');
    try {
      const payload = {
        topic: topic.trim(),
        industry: industry || undefined,
        tone: tone || undefined,
        target_audience: targetAudience || undefined,
        brainstorm_context: keyPoints?.trim() || undefined,
      };
      console.log('[KeyPointsSection] calling API with payload:', payload);
      const res = await generateKeyPoints(payload);
      console.log('[KeyPointsSection] API response:', JSON.stringify(res).slice(0, 500));
      if (res.success && res.data?.key_point_sets?.length) {
        console.log('[KeyPointsSection] got', res.data.key_point_sets.length, 'key point sets');
        setSets(res.data.key_point_sets);
        setPhase('ready');
      } else {
        console.log('[KeyPointsSection] no key points or success=false', res.success, res.data?.key_point_sets?.length);
        setErrorMsg(res?.error || 'No key points returned. Try a different topic.');
        setPhase('idle');
      }
    } catch (err) {
      console.log('[KeyPointsSection] API call failed:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(msg);
      setPhase('idle');
    }
  };

  const handleSelectSet = (kps: KeyPointSet) => {
    onChange(kps.points.join(' / '));
    setPhase('idle');
    setSets([]);
    setErrorMsg(null);
  };

  const handleBack = () => {
    setPhase('idle');
    setSets([]);
    setErrorMsg(null);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Points</label>
      {phase === 'ready' ? (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280' }}>Choose the angle that fits your post best:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sets.map((kps) => (
              <div
                key={kps.id}
                onClick={() => handleSelectSet(kps)}
                style={{
                  border: '1.5px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '11px 14px',
                  cursor: 'pointer',
                  background: '#fff',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(139,92,246,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  }}>{kps.id}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{kps.title}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                  {kps.points.map((p, pi) => <li key={pi}>{p}</li>)}
                </ul>
                <div style={{ marginTop: 7, fontSize: 11.5, color: '#8b5cf6', fontWeight: 600, fontStyle: 'italic' }}>
                  💡 {kps.reason_to_choose}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleBack}
            style={{
              marginTop: 8, padding: '5px 12px', border: '1px solid #d1d5db',
              borderRadius: 6, background: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#6b7280',
            }}
          >
            ← Back to manual entry
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <textarea
            value={keyPoints}
            onChange={e => { onChange(e.target.value); setErrorMsg(null); }}
            placeholder="Key point 1 / Key point 2 / Key point 3"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {phase === 'generating' ? (
            <div style={{
              position: 'absolute', right: 6, bottom: 8,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              background: '#f3f4f6', color: '#6b7280',
              fontSize: 12, fontWeight: 600,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid #8b5cf6', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
              Generating...
            </div>
          ) : (
            <button
              type="button"
              disabled={!topic.trim()}
              onClick={handleGenerate}
              style={{
                position: 'absolute', right: 6, bottom: 8,
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: topic.trim()
                  ? 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                  : '#f3f4f6',
                color: topic.trim() ? '#fff' : '#9ca3af',
                fontWeight: 700, fontSize: 12,
                cursor: topic.trim() ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: topic.trim() ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (topic.trim()) { e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #4f46e5)'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (topic.trim()) { e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              ✨ Get Key Points
            </button>
          )}
          {errorMsg && (
            <div style={{
              position: 'absolute', left: 6, bottom: 8,
              fontSize: 11, color: '#b91c1c', fontWeight: 500,
              maxWidth: 'calc(100% - 140px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ⚠ {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
