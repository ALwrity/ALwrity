import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LinkedInPreferences } from '../utils/storageUtils';

export type QuickCreateContentType = 'post' | 'article' | 'carousel' | 'video_script';

interface QuickCreateProps {
  onGeneratePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateArticle: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateCarousel: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateVideoScript: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
  /** Hide inline grid — modals only (opened via workflow / events) */
  variant?: 'default' | 'hidden';
}

type ContentType = QuickCreateContentType;

const CONTENT_TYPES: { type: ContentType; label: string; icon: string; description: string; color: string }[] = [
  { type: 'post', label: 'Post', icon: '📝', description: 'Professional LinkedIn post with engagement hooks', color: '#0a66c2' },
  { type: 'article', label: 'Article', icon: '📄', description: 'Thought leadership article with in-depth analysis', color: '#057642' },
  { type: 'carousel', label: 'Carousel', icon: '🎠', description: 'Multi-slide carousel for visual storytelling', color: '#8b5cf6' },
  { type: 'video_script', label: 'Video Script', icon: '🎬', description: 'Engaging video script with hook & scenes', color: '#dc2626' }
];

const TONES = ['Professional', 'Conversational', 'Authoritative', 'Inspirational', 'Educational', 'Friendly'];
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Marketing', 'Consulting', 'Real Estate', 'Legal', 'Non-profit', 'Entertainment', 'Energy', 'Custom'];

const defaultForm = {
  topic: '',
  industry: '',
  tone: '',
  target_audience: '',
  key_points: '',
  post_type: '',
  word_count: 1500,
  number_of_slides: 8,
  video_length: 60,
  key_takeaways: '',
  key_messages: '',
  key_sections: ''
};

export const QuickCreate: React.FC<QuickCreateProps> = ({
  onGeneratePost,
  onGenerateArticle,
  onGenerateCarousel,
  onGenerateVideoScript,
  userPreferences,
  variant = 'default',
}) => {
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [generating, setGenerating] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  const openModal = useCallback((type: ContentType) => {
    setFormData({
      ...defaultForm,
      industry: userPreferences?.industry || '',
      tone: userPreferences?.tone || 'Professional',
      target_audience: userPreferences?.target_audience || '',
    });
    setSelectedType(type);
  }, [userPreferences]);

  const closeModal = useCallback(() => {
    setSelectedType(null);
    setFormData(defaultForm);
    setTopicError(null);
  }, []);

  useEffect(() => {
    const onOpenQuickCreate = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (
        type === 'post' ||
        type === 'article' ||
        type === 'carousel' ||
        type === 'video_script'
      ) {
        openModal(type);
      }
    };
    window.addEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
    return () => window.removeEventListener('linkedinwriter:openQuickCreate', onOpenQuickCreate);
  }, [openModal]);

  useEffect(() => {
    if (!selectedType) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedType, closeModal]);

  const handleGenerate = async () => {
    if (!selectedType || generating) return;
    if (!formData.topic.trim()) {
      setTopicError('Please enter a topic to continue.');
      return;
    }
    setTopicError(null);
    setGenerating(true);
    const params = { ...formData };
    try {
      const generators = {
        post: onGeneratePost,
        article: onGenerateArticle,
        carousel: onGenerateCarousel,
        video_script: onGenerateVideoScript
      };
      await generators[selectedType](params);
      closeModal();
    } finally {
      setGenerating(false);
    }
  };

  const setField = (field: string, value: any) => {
    if (field === 'topic' && topicError) {
      setTopicError(null);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const modalContent = useMemo(() => {
    if (!selectedType) return null;

    const commonFields = (
      <>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Topic *</label>
          <input
            value={formData.topic}
            onChange={e => setField('topic', e.target.value)}
            placeholder={`e.g., ${selectedType === 'video_script' ? 'Networking tips' : 'AI trends in ' + (formData.industry || 'Technology')}`}
            style={{ width: '100%', padding: '10px 12px', border: `1px solid ${topicError ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          {topicError && (
            <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 12 }}>{topicError}</p>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Industry</label>
            <select
              value={formData.industry}
              onChange={e => setField('industry', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white' }}
            >
              {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Tone</label>
            <select
              value={formData.tone}
              onChange={e => setField('tone', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white' }}
            >
              {TONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Target Audience</label>
          <input
            value={formData.target_audience}
            onChange={e => setField('target_audience', e.target.value)}
            placeholder="e.g., Product Managers, CTOs"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </>
    );

    switch (selectedType) {
      case 'post':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Post</h3>
            {commonFields}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Points</label>
              <textarea
                value={formData.key_points}
                onChange={e => setField('key_points', e.target.value)}
                placeholder="Key point 1 / Key point 2 / Key point 3"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'article':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Article</h3>
            {commonFields}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Word Count</label>
              <input
                type="number"
                value={formData.word_count}
                onChange={e => setField('word_count', parseInt(e.target.value) || 1500)}
                min={500}
                max={5000}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Sections</label>
              <textarea
                value={formData.key_sections}
                onChange={e => setField('key_sections', e.target.value)}
                placeholder="Introduction / Current challenges / Best practices / Future outlook"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'carousel':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Carousel</h3>
            {commonFields}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Number of Slides</label>
              <input
                type="number"
                value={formData.number_of_slides}
                onChange={e => setField('number_of_slides', parseInt(e.target.value) || 8)}
                min={3}
                max={20}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Takeaways</label>
              <textarea
                value={formData.key_takeaways}
                onChange={e => setField('key_takeaways', e.target.value)}
                placeholder="Key insight / Important trend / Actionable tip"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
      case 'video_script':
        return (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>Generate LinkedIn Video Script</h3>
            {commonFields}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Video Length (seconds)</label>
              <input
                type="number"
                value={formData.video_length}
                onChange={e => setField('video_length', parseInt(e.target.value) || 60)}
                min={15}
                max={600}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#374151' }}>Key Messages</label>
              <textarea
                value={formData.key_messages}
                onChange={e => setField('key_messages', e.target.value)}
                placeholder="Core message / Practical advice / Call to action"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        );
    }
  }, [selectedType, formData, topicError]);

  const showInlineGrid = variant === 'default';

  return (
    <div style={{ width: '100%', marginTop: showInlineGrid ? 8 : 0 }}>
      {showInlineGrid && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, textAlign: 'center' }}>Quick Create</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {CONTENT_TYPES.map(({ type, label, icon, description, color }) => (
              <button
                key={type}
                onClick={() => openModal(type)}
                style={{
                  padding: '14px 10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: '1.3' }}>{description}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Generation Modal */}
      {selectedType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: 20 }}>
          <div style={{ background: 'white', width: 520, maxWidth: '100%', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{CONTENT_TYPES.find(c => c.type === selectedType)?.icon} {CONTENT_TYPES.find(c => c.type === selectedType)?.label}</div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: '4px 8px', borderRadius: 6 }}>✕</button>
            </div>
            <div style={{ padding: 16, maxHeight: '60vh', overflow: 'auto' }}>
              {modalContent}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeModal} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 8,
                  background: generating ? '#9ca3af' : CONTENT_TYPES.find(c => c.type === selectedType)?.color || '#0a66c2',
                  color: 'white',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: generating ? 0.7 : 1
                }}
              >
                {generating && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />}
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
