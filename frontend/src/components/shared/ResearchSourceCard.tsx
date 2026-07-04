import React, { useState } from 'react';

export interface ResearchSourceLike {
  title: string;
  url: string;
  excerpt?: string;
  content?: string;
  relevance_score?: number;
  credibility_score?: number;
  domain_authority?: number;
  source_type?: string;
  publication_date?: string;
  index?: number;
  highlights?: string[];
  summary?: string;
  image?: string;
  author?: string;
}

interface ResearchSourceCardProps {
  source: ResearchSourceLike;
  index?: number;
  accent?: string;
  maxContentPreview?: number;
  showRelevance?: boolean;
  showDomainAuthority?: boolean;
  showTextToSpeech?: boolean;
  TextToSpeechButton?: React.ComponentType<{ text: string; size?: 'small' | 'medium' | 'large'; showSettings?: boolean }>;
}

const formatScore = (score: number): string => `${Math.round(score * 100)}%`;

const formatCredibilityGauge = (score: number): React.ReactNode => {
  const percentage = Math.round(score * 100);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#22c55e' : percentage >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: '44px', height: '44px' }}>
        <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r={radius} stroke="#e0e0e0" strokeWidth="4" fill="none" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '10px',
            fontWeight: '600',
            color,
          }}
        >
          {percentage}%
        </div>
      </div>
    </div>
  );
};

const hostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const ResearchSourceCard: React.FC<ResearchSourceCardProps> = ({
  source,
  index,
  accent = '#0a66c2',
  maxContentPreview = 2000,
  showRelevance = false,
  showDomainAuthority = false,
  showTextToSpeech = false,
  TextToSpeechButton,
}) => {
  const [showExtra, setShowExtra] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const allHighlights = source.highlights || [];
  const firstHighlight = allHighlights.length > 0 ? allHighlights[0] : null;
  const remainingHighlights = allHighlights.length > 1 ? allHighlights.slice(1) : [];
  const hasSummary = !!source.summary;
  const hasContent = !!source.content;
  const serpIndex = source.index !== undefined ? source.index + 1 : index !== undefined ? index + 1 : null;

  const extraCount = remainingHighlights.length + (hasSummary ? 1 : 0);

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        borderLeft: `4px solid ${accent}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {serpIndex !== null && (
              <span style={{ backgroundColor: '#e3f2fd', color: '#1976d2', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                SERP Ranking {serpIndex}
              </span>
            )}
            {source.source_type && (
              <span style={{ backgroundColor: '#f3e5f5', color: '#7b1fa2', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                {(source.source_type || 'web').replace('_', ' ')}
              </span>
            )}
            {source.publication_date ? (
              <span style={{ backgroundColor: '#e8f5e8', color: '#2e7d32', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                {source.publication_date}
              </span>
            ) : (
              <span style={{ backgroundColor: '#f5f5f5', color: '#666', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                No date
              </span>
            )}
            {source.author && (
              <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                ✍️ {source.author}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '4px' }}>
            {source.image && (
              <img
                src={source.image}
                alt=""
                style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0, border: '1px solid #e0e0e0' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#333', lineHeight: '1.3' }}>
                {source.title}
              </h4>
            </div>
          </div>
        </div>
        {source.credibility_score !== undefined && source.credibility_score !== null
          ? formatCredibilityGauge(source.credibility_score)
          : null}
      </div>

      <p style={{ margin: '8px 0 6px 0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
        {source.excerpt || (source.content ? source.content.substring(0, 160) + (source.content.length > 160 ? '...' : '') : '')}
      </p>

      {firstHighlight && (
        <div style={{ fontSize: '11px', color: '#475569', padding: '4px 8px', backgroundColor: '#f9fafb', borderRadius: '4px', borderLeft: '2px solid #d1d5db', marginBottom: '6px' }}>
          {firstHighlight}
        </div>
      )}

      {extraCount > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <button
            onClick={() => setShowExtra(!showExtra)}
            style={{
              background: 'none',
              border: 'none',
              color: accent,
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {showExtra ? '▾ Show less' : `▸ Show more (${extraCount} more)`}
          </button>
          {showExtra && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hasSummary && (
                <div style={{ fontSize: '11px', color: '#475569', backgroundColor: '#f0f9ff', borderRadius: '4px', padding: '6px 8px', borderLeft: '2px solid #3b82f6' }}>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>Summary: </span>
                  {source.summary}
                </div>
              )}
              {remainingHighlights.map((h, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#555', padding: '4px 8px', backgroundColor: '#f9fafb', borderRadius: '4px', borderLeft: '2px solid #d1d5db' }}>
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {hasContent && (
        <div style={{ marginBottom: '6px' }}>
          <button
            onClick={() => setShowFullText(!showFullText)}
            style={{
              background: 'none',
              border: 'none',
              color: '#7b1fa2',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {showFullText ? '▾ Hide full text' : '▸ View full text'}
          </button>
          {showFullText && source.content && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#555',
                lineHeight: '1.6',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                padding: '8px',
                border: '1px solid #e5e7eb',
              }}
            >
              {source.content.length > maxContentPreview
                ? source.content.substring(0, maxContentPreview) + '...'
                : source.content}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: '#666' }}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: 'none', fontWeight: '500' }}>
            Source from {hostname(source.url)}
          </a>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {showRelevance && source.relevance_score !== undefined && (
            <span style={{ backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#166534' }}>
              Relevance: {formatScore(source.relevance_score)}
            </span>
          )}
          {showDomainAuthority && source.domain_authority !== undefined && (
            <span style={{ backgroundColor: '#fefce8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#854d0e' }}>
              DA: {Math.round(source.domain_authority)}
            </span>
          )}
          {showTextToSpeech && TextToSpeechButton && (
            <TextToSpeechButton text={`${source.title}. ${source.excerpt || source.content || ''}`} size="small" showSettings={false} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchSourceCard;