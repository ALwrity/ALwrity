import React from 'react';

export interface PersonalizedIdeaItem {
  title: string;
  rationale: string;
  suggested_hook?: string;
  data_source: string;
}

interface PersonalizedIdeasPanelProps {
  ideas: PersonalizedIdeaItem[];
  dataSummary: string;
  onGeneratePost: (title: string) => void;
  onRefresh: () => void;
  onBack?: () => void;
}

const PersonalizedIdeasPanel: React.FC<PersonalizedIdeasPanelProps> = ({
  ideas,
  dataSummary,
  onGeneratePost,
  onRefresh,
  onBack,
}) => {
  return (
    <div style={{ padding: 20 }}>
      {onBack && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: 'white',
              color: '#374151',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Back to options
          </button>
        </div>
      )}
      <div style={{ marginBottom: 16, fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        Personalized content angles
        <span style={{ fontSize: 11, color: '#0891b2', background: '#cffafe', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}>
          🎯 Based on your data
        </span>
      </div>

      {dataSummary && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 14, padding: '6px 12px', background: '#f3f4f6', borderRadius: 8 }}>
          {dataSummary}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        {ideas.map((idea, i) => {
          const dataSourceLabel = idea.data_source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return (
            <div
              key={i}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '14px 18px',
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 14, color: '#111827', fontWeight: 700, lineHeight: 1.4 }}>
                {idea.title}
              </div>
              {idea.suggested_hook && (
                <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12, fontStyle: 'italic', lineHeight: 1.3 }}>
                  Hook: &ldquo;{idea.suggested_hook}&rdquo;
                </div>
              )}
              <div style={{ marginTop: 6, color: '#374151', fontSize: 12, lineHeight: 1.3 }}>
                {idea.rationale}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onGeneratePost(idea.title)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0a66c2',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Generate post
                </button>
                <span style={{ fontSize: 10, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
                  {dataSourceLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: 'white',
            color: '#374151',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔄 Try again with fresh data
        </button>
      </div>
    </div>
  );
};

export default PersonalizedIdeasPanel;
