import React from 'react';

type ProgressStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
  message?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

interface ProgressTrackerProps {
  steps: ProgressStep[];
  active: boolean;
}

/* Educational descriptions shown beneath each step's label */
const STEP_EDUCATION: Record<string, string> = {
  personalize: 'We analyze your topic, industry, and target audience to tailor the content for maximum LinkedIn engagement and relevance.',
  prepare_queries: 'Smart research queries are crafted to find authoritative, up-to-date sources — ensuring your content is built on reliable data.',
  research: 'We search across trusted sources to collect statistics, trends, case studies, and insights that make your content credible and valuable.',
  grounding: 'Every claim, statistic, and data point is mapped back to its original source — this is what makes your content trustworthy and authoritative.',
  content_generation: 'Your content is written with LinkedIn-optimized structure: strong hooks, scannable formatting, professional tone, and engagement-driving elements.',
  citations: 'Factual claims are linked to their sources with visible [Source N] markers — building transparency and credibility with your audience.',
  quality_analysis: 'The content is reviewed for engagement potential, readability, LinkedIn best practices, and alignment with your chosen tone and audience.',
  finalize: 'Final formatting tweaks, hashtag integration, and platform-specific optimizations are applied before delivering the result.'
};

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ steps, active }) => {
  if (!steps || steps.length === 0) return null;
  
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progressPercentage = Math.round((completedSteps / steps.length) * 100);

  return (
    <div style={{
      marginBottom: '24px',
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid rgba(10,102,194,0.1)',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: '0 2px 12px rgba(10,102,194,0.06)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(10,102,194,0.06)'
      }}>
        <div>
          <div style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#0f172a',
            marginBottom: '2px'
          }}>
            Content Generation
          </div>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            lineHeight: '1.4'
          }}>
            {active
              ? 'Researching, writing, and optimizing your content'
              : 'Generation complete — your content is ready below.'}
          </div>
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: progressPercentage === 100 ? '#10b981' : '#0a66c2',
          padding: '4px 12px',
          background: progressPercentage === 100
            ? 'rgba(16,185,129,0.08)'
            : 'rgba(10,102,194,0.08)',
          borderRadius: '20px',
          whiteSpace: 'nowrap'
        }}>
          {progressPercentage}%
        </div>
      </div>
      
      {/* Steps */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.id} style={{
              display: 'flex',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: step.status === 'active' ? 'rgba(10,102,194,0.04)' : 'transparent',
              transition: 'all 300ms ease',
              position: 'relative'
            }}>
              {/* Step indicator + connector line */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                width: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: step.status === 'completed' ? '#10b981' : 
                             step.status === 'active' ? '#0a66c2' : 
                             step.status === 'error' ? '#ef4444' : '#e2e8f0',
                  color: step.status === 'completed' || step.status === 'active' || step.status === 'error' ? 'white' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: '700',
                  transition: 'all 300ms ease'
                }}>
                  {step.status === 'completed' ? (
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7.5L6 10.5L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : step.status === 'active' ? (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'white',
                      animation: 'progressPulse 1.5s ease-in-out infinite'
                    }} />
                  ) : step.status === 'error' ? (
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4L10 10M10 4L4 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                {/* Connector line to next step */}
                {!isLast && (
                  <div style={{
                    width: '1.5px',
                    flex: 1,
                    minHeight: '6px',
                    background: step.status === 'completed' ? '#10b981' : '#e2e8f0',
                    marginTop: '3px',
                    transition: 'background 300ms ease'
                  }} />
                )}
              </div>
              
              {/* Step content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: step.status === 'active' ? '#0a66c2' : 
                         step.status === 'completed' ? '#0f172a' : 
                         step.status === 'error' ? '#ef4444' : '#94a3b8',
                  marginBottom: step.status === 'active' ? '4px' : '0',
                  transition: 'color 200ms ease'
                }}>
                  {step.label}
                </div>
                
                {/* Educational description — shown only while active */}
                {step.status === 'active' && (
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    lineHeight: '1.5'
                  }}>
                    {STEP_EDUCATION[step.id] || step.message || ''}
                  </div>
                )}
                
                {/* Step message */}
                {step.message && step.status !== 'active' && (
                  <div style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    lineHeight: '1.4',
                    marginTop: '2px'
                  }}>
                    {step.message}
                  </div>
                )}
                
                {/* Step details */}
                {step.details && step.status === 'completed' && (
                  <div style={{
                    marginTop: '4px',
                    padding: '4px 8px',
                    background: 'rgba(16,185,129,0.06)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#065f46'
                  }}>
                    {Object.entries(step.details).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '1px' }}>
                        <strong>{key}:</strong> {String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Active status indicator */}
      {active && (
        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          background: 'rgba(10,102,194,0.03)',
          borderRadius: '8px',
          border: '1px solid rgba(10,102,194,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#0a66c2',
            flexShrink: 0
          }} />
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            lineHeight: '1.5',
            flex: 1
          }}>
            <strong style={{ color: '#0a66c2' }}>Why this matters:</strong> Every step produces research-backed, LinkedIn-optimized content with visible source citations.
          </div>
        </div>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes progressPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ProgressTracker;
