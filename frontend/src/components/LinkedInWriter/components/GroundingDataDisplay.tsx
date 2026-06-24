import React, { useState } from 'react';
import { ResearchSource, Citation, ContentQualityMetrics } from '../../../services/linkedInWriterApi';

interface GroundingDataDisplayProps {
  researchSources: ResearchSource[];
  citations: Citation[];
  qualityMetrics?: ContentQualityMetrics;
  groundingEnabled: boolean;
}

const SourceCard: React.FC<{ source: ResearchSource; index: number }> = ({ source, index }) => {
  const [showFullContent, setShowFullContent] = useState(false);

  const formatScore = (score: number) => `${(score * 100).toFixed(0)}%`;

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      borderLeft: '4px solid #0a66c2',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '8px'
      }}>
        <h5 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: '#1f2937',
          flex: 1,
          marginRight: '8px'
        }}>
          {source.title}
        </h5>
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          backgroundColor: '#f3f4f6',
          padding: '4px 10px',
          borderRadius: '12px',
          whiteSpace: 'nowrap'
        }}>
          Source {index + 1}
        </div>
      </div>

      <div style={{
        fontSize: '13px',
        color: '#6b7280',
        marginBottom: '10px',
        wordBreak: 'break-all'
      }}>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#0a66c2',
            textDecoration: 'none'
          }}
        >
          ↗ {source.url}
        </a>
      </div>

      {/* Content preview (expandable) */}
      {source.content && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontSize: '13px',
            color: '#4b5563',
            lineHeight: '1.5',
            ...(!showFullContent ? {
              maxHeight: '60px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            } : {})
          }}>
            {source.content}
          </div>
          {source.content.length > 200 && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0a66c2',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 0',
                fontWeight: '600'
              }}
            >
              {showFullContent ? 'Show less' : 'Show full text'}
            </button>
          )}
        </div>
      )}

      {/* Source type badge and scores */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        fontSize: '11px'
      }}>
        {source.source_type && (
          <span style={{
            backgroundColor: '#eef6ff',
            padding: '4px 8px',
            borderRadius: '6px',
            fontWeight: '600',
            color: '#0a66c2'
          }}>
            {source.source_type.replace('_', ' ')}
          </span>
        )}
        {source.relevance_score && (
          <span style={{
            backgroundColor: '#f0fdf4',
            padding: '4px 8px',
            borderRadius: '6px',
            color: '#166534'
          }}>
            Relevance: {formatScore(source.relevance_score)}
          </span>
        )}
        {source.credibility_score && (
          <span style={{
            backgroundColor: '#fefce8',
            padding: '4px 8px',
            borderRadius: '6px',
            color: '#854d0e'
          }}>
            Credibility: {formatScore(source.credibility_score)}
          </span>
        )}
      </div>
    </div>
  );
};


export const GroundingDataDisplay: React.FC<GroundingDataDisplayProps> = ({
  researchSources,
  citations,
  qualityMetrics,
  groundingEnabled
}) => {
  
  if (!groundingEnabled || researchSources.length === 0) {
    return null;
  }

  return (
    <div style={{
      margin: '24px 0',
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      backgroundColor: '#fff',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      position: 'relative',
      zIndex: 1,
      minHeight: '120px',
      fontSize: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: '#0a66c2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px'
        }}>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>S</span>
        </div>
        <h3 style={{
          margin: 0,
          color: '#0a66c2',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          Research Sources & Citations
        </h3>
      </div>

      {/* Research Sources */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{
          margin: '0 0 16px 0',
          fontSize: '15px',
          fontWeight: '600',
          color: '#374151'
        }}>
          Sources Used ({researchSources.length})
        </h4>
        <div style={{
          display: 'grid',
          gap: '12px'
        }}>
          {researchSources.map((source, index) => (
            <SourceCard key={index} source={source} index={index} />
          ))}
        </div>
      </div>

      {/* Citations */}
      {citations.length > 0 && (
        <div>
          <h4 style={{
            margin: '0 0 12px 0',
            fontSize: '15px',
            fontWeight: '600',
            color: '#374151'
          }}>
            Inline Citations ({citations.length})
          </h4>
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '12px'
            }}>
              The content above includes {citations.length} inline {citations.length === 1 ? 'citation' : 'citations'} linking to research sources. Hover over <sup>[N]</sup> markers in the text for details.
            </div>
            <div style={{
              display: 'grid',
              gap: '6px'
            }}>
              {citations.map((citation, index) => (
                <div key={index} style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#374151',
                  border: '1px solid #f3f4f6'
                }}>
                  <strong style={{ color: '#0a66c2' }}>{citation.reference}</strong>
                  {citation.text && (
                    <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                      "{citation.text.substring(0, 100)}{citation.text.length > 100 ? '..."' : '"'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        Content generated with AI using real-time web research. Claims backed by verifiable sources.
      </div>
    </div>
  );
};
