import React, { useState } from 'react';
import { useCopilotTrigger } from '../../hooks/useCopilotTrigger';
import BlogWriterPhasesSection from './BlogWriterPhasesSection';
import { BlogWorkflowHeroSection } from './dashboard/BlogWorkflowHeroSection';

interface BlogWriterLandingProps {
  onStartWriting: () => void;
  /** Optional: lets the new radial workflow wedges jump straight to a specific phase. */
  navigateToPhase?: (phase: string) => void;
  hasResearch?: boolean;
  /** Optional: restores a saved blog asset (Remarket wedge "Refresh this post", Create wedge "Continue draft"). */
  onRestoreAsset?: (assetId: number) => void;
}

const BlogWriterLanding: React.FC<BlogWriterLandingProps> = ({
  onStartWriting,
  navigateToPhase,
  hasResearch,
  onRestoreAsset,
}) => {
  const [showSuperPowers, setShowSuperPowers] = useState(false);
  const { triggerResearch } = useCopilotTrigger();

  const handleStartWriting = () => {
    // Open the copilot sidebar (same functionality as LinkedIn writer)
    const copilotButton = document.querySelector('.copilotkit-open-button') ||
                         document.querySelector('[data-copilot-open]') ||
                         document.querySelector('button[aria-label*="Open"]') ||
                         document.querySelector('.alwrity-copilot-sidebar button');
    
    if (copilotButton) {
      (copilotButton as HTMLElement).click();
    } else {
      // Fallback: scroll to bottom right where the button should be
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    
    // Also call the parent callback
    onStartWriting();
  };

  const superPowers = [
    {
      icon: "🔍",
      title: "AI-Powered Research",
      description: "Comprehensive research with Google Search grounding, competitor analysis, and content gap identification"
    },
    {
      icon: "📝",
      title: "Intelligent Outline Generation",
      description: "AI-generated outlines with source mapping, grounding insights, and optimization recommendations"
    },
    {
      icon: "✨",
      title: "Content Enhancement",
      description: "Section-by-section content generation with SEO optimization and engagement improvements"
    },
    {
      icon: "🎯",
      title: "SEO Intelligence",
      description: "Advanced SEO analysis, metadata generation, and keyword optimization for maximum visibility"
    },
    {
      icon: "🔍",
      title: "Fact-Checking & Quality",
      description: "Hallucination detection, claim verification, and content quality assurance"
    },
    {
      icon: "🚀",
      title: "Multi-Platform Publishing",
      description: "Direct publishing to WordPress, Wix, and other platforms with scheduling capabilities"
    }
  ];

  return (
    <>
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundImage: 'url(/blog-writer-bg.png)',
        backgroundSize: '56% auto',
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '16px',
        overflow: 'hidden'
      }}>

        {/* Main content container */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'left',
          maxWidth: '400px',
          padding: '20px 16px',
          flex: '0 0 auto',
          boxSizing: 'border-box'
        }}>
          {/* Main heading */}
          <div style={{
            marginBottom: '20px'
          }}>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: '0 0 20px 0',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              lineHeight: '1.2'
            }}>
              AI-First, Contextual, Click through Blog Writer
            </h1>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            {/* Primary CTA Button */}
            <button
              onClick={handleStartWriting}
              style={{
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                color: 'white',
                border: 'none',
                padding: '9px 24px',
                borderRadius: '50px',
                fontSize: '0.6rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                minWidth: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(25, 118, 210, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)';
              }}
            >
              <span style={{ position: 'relative', zIndex: 2 }}>
                ✨ Chat/Write with ALwrity Copilot
              </span>
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transition: 'left 0.5s ease'
              }} />
            </button>

            {/* Secondary CTA Button */}
            <button
              onClick={() => setShowSuperPowers(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#1976d2',
                border: '2px solid #1976d2',
                padding: '7px 18px',
                borderRadius: '50px',
                fontSize: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 7px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                minWidth: '140px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1976d2';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 3px 10px rgba(25, 118, 210, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                e.currentTarget.style.color = '#1976d2';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 7px rgba(0,0,0,0.1)';
              }}
            >
              🚀 ALwrity Blog Writer SuperPowers
            </button>
          </div>


        </div>

        {/* Radial Workflow Hero (6 wedges) — now part of the same hero section,
            sitting beside the headline and CTAs on desktop and stacking below on mobile. */}
        <BlogWorkflowHeroSection
          inline
          onStartWriting={handleStartWriting}
          navigateToPhase={navigateToPhase}
          hasResearch={hasResearch}
          onRestoreAsset={onRestoreAsset}
        />
      </div>

      {/* SuperPowers Modal with 6 Phases */}
      {showSuperPowers && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            width: '100%',
            maxWidth: '1400px',
            minHeight: '100%',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              paddingBottom: '20px',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <div>
                <h2 style={{
                  margin: '0 0 8px 0',
                  fontSize: '2rem',
                  background: 'linear-gradient(135deg, #1976d2 0%, #9c27b0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  🚀 ALwrity Blog Writer SuperPowers
                </h2>
                <p style={{ margin: 0, color: '#666', fontSize: '1.1rem' }}>
                  Discover the powerful features that make ALwrity the ultimate blog writing assistant
                </p>
              </div>
              <button
                onClick={() => setShowSuperPowers(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '8px',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#999';
                }}
              >
                ×
              </button>
            </div>

            {/* 6 Phases Section */}
            <BlogWriterPhasesSection />
            
            {/* Quick SuperPowers Grid */}
            <div style={{ padding: '40px', borderTop: '1px solid #f0f0f0' }}>
              <h2 style={{
                margin: '0 0 20px 0',
                fontSize: '1.5rem',
                textAlign: 'center',
                color: '#333'
              }}>
                Quick Feature Overview
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                {superPowers.map((power, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e0e0e0',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                      e.currentTarget.style.borderColor = '#1976d2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = '#e0e0e0';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        fontSize: '2rem',
                        width: '60px',
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                        borderRadius: '12px'
                      }}>
                        {power.icon}
                      </div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        color: '#333',
                        fontWeight: '600'
                      }}>
                        {power.title}
                      </h3>
                    </div>
                    <p style={{
                      margin: 0,
                      color: '#666',
                      lineHeight: '1.6',
                      fontSize: '0.9rem'
                    }}>
                      {power.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid #f0f0f0',
              textAlign: 'center'
            }}>
              <button
                onClick={handleStartWriting}
                style={{
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '50px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(25, 118, 210, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(25, 118, 210, 0.3)';
                }}
              >
                ✨ Chat/Write with ALwrity Copilot
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default BlogWriterLanding;
