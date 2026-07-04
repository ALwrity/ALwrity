import React from 'react';
import { ResearchSource, Citation, ContentQualityMetrics } from '../../../services/linkedInWriterApi';
import ResearchSourceCard from '../../shared/ResearchSourceCard';
import { TextToSpeechButton } from '../../shared/TextToSpeechButton';

interface GroundingDataDisplayProps {
  researchSources: ResearchSource[];
  citations: Citation[];
  qualityMetrics?: ContentQualityMetrics;
  groundingEnabled: boolean;
}


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
            <ResearchSourceCard
              key={index}
              source={source}
              index={index}
              accent="#0a66c2"
              showRelevance
              showTextToSpeech
              TextToSpeechButton={TextToSpeechButton}
            />
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
