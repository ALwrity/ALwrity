import React from 'react';
import { LI_Z_MODAL } from '../utils/linkedInStudioZIndex';
import { createPortal } from 'react-dom';

interface InfoModalsProps {
  showCopilotModal: boolean;
  showAssistiveModal: boolean;
  showFactCheckModal: boolean;
  onCloseCopilotModal: () => void;
  onCloseAssistiveModal: () => void;
  onCloseFactCheckModal: () => void;
  onOpenCopilot: () => void;
  onStartQuickCreatePost?: () => void;
}

export const InfoModals: React.FC<InfoModalsProps> = ({
  showCopilotModal,
  showAssistiveModal,
  showFactCheckModal,
  onCloseCopilotModal,
  onCloseAssistiveModal,
  onCloseFactCheckModal,
  onOpenCopilot,
  onStartQuickCreatePost,
}) => {
  const infoModalOverlayStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: LI_Z_MODAL,
    backdropFilter: 'blur(5px)',
  };
  return (
    <>
      {/* Copilot Modal */}
      {showCopilotModal && createPortal(
        <div style={infoModalOverlayStyle}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button
              onClick={onCloseCopilotModal}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ×
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 16px 0', color: '#1a202c', fontSize: '24px', fontWeight: '700' }}>
                ALwrity Co-Pilot
              </h2>
              <p style={{ margin: '0 0 20px 0', color: '#4a5568', fontSize: '16px' }}>
                Your comprehensive AI writing assistant
              </p>
              
              {/* Screenshot Images */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px', 
                marginBottom: '20px' 
              }}>
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src="/alwrity-copilot1.png" 
                    alt="ALwrity Co-Pilot Interface"
                    style={{
                      width: '100%',
                      maxWidth: '250px',
                      height: 'auto',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      border: '1px solid #e2e8f0'
                    }}
                  />
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Main Interface
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src="/alwrity-copilot2.png" 
                    alt="ALwrity Co-Pilot Features"
                    style={{
                      width: '100%',
                      maxWidth: '250px',
                      height: 'auto',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      border: '1px solid #e2e8f0'
                    }}
                  />
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Advanced Features
                  </p>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'left' }}>
              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                What is ALwrity Co-Pilot?
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '20px' }}>
                ALwrity Co-Pilot is an advanced AI assistant that provides comprehensive support for all your content creation needs.
                It combines multiple AI capabilities to help you create, edit, and optimize content across various formats.
              </p>

              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                Key Features:
              </h3>
              <ul style={{ color: '#4a5568', lineHeight: '1.6', paddingLeft: '20px', marginBottom: '20px' }}>
                <li>Generate LinkedIn posts, articles, carousels, and video scripts</li>
                <li>Real-time content editing and optimization suggestions</li>
                <li>Research-backed content with source citations</li>
                <li>Persona-aware writing tailored to your audience</li>
                <li>Fact-checking and verification capabilities</li>
                <li>Multi-format content creation (text, images, videos)</li>
              </ul>

              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                How to Use:
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '20px' }}>
                Click the ALwrity Co-Pilot icon in the bottom-right corner of your screen to open the chat interface.
                You can then ask for help with any content creation task, and the AI will guide you through the process.
              </p>

              <button
                onClick={() => {
                  onCloseCopilotModal();
                  onOpenCopilot();
                }}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Open ALwrity Co-Pilot
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assistive Research Modal */}
      {showAssistiveModal && createPortal(
        <div style={infoModalOverlayStyle}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button
              onClick={onCloseAssistiveModal}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ×
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔬</div>
              <h2 style={{ margin: '0 0 8px 0', color: '#1a202c', fontSize: '24px', fontWeight: '700' }}>
                Assistive Research Writing
              </h2>
              <p style={{ margin: 0, color: '#4a5568', fontSize: '16px' }}>
                Real-time AI writing assistance with research-backed suggestions
              </p>
            </div>

            <div style={{ textAlign: 'left' }}>
              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                What is Assistive Research Writing?
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '20px' }}>
                Assistive Research Writing provides real-time, contextual writing suggestions as you type. 
                It combines AI-powered content generation with web research to provide accurate, up-to-date information 
                and suggestions that enhance your writing quality and credibility.
              </p>

              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                Key Features:
              </h3>
              <ul style={{ color: '#4a5568', lineHeight: '1.6', paddingLeft: '20px', marginBottom: '20px' }}>
                <li>Real-time writing suggestions as you type</li>
                <li>Research-backed content with source citations</li>
                <li>Contextual continuation of your thoughts</li>
                <li>Fact-checking and verification of claims</li>
                <li>Smart gating to prevent excessive API usage</li>
                <li>Seamless integration with your writing flow</li>
              </ul>

              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                How to Use:
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '20px' }}>
                Enable Assistive Writing in the editor settings. Once enabled, start typing your content. 
                After typing 5+ words and pausing for 5 seconds, you'll receive contextual writing suggestions. 
                You can accept, dismiss, or request more suggestions as needed.
              </p>

              <button
                onClick={() => {
                  if (onStartQuickCreatePost) {
                    onStartQuickCreatePost();
                  } else {
                    onCloseAssistiveModal();
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(240, 147, 251, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Start a new post →
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fact Check Modal */}
      {showFactCheckModal && createPortal(
        <div style={infoModalOverlayStyle}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button
              onClick={onCloseFactCheckModal}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ×
            </button>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h2 style={{ margin: '0 0 8px 0', color: '#1a202c', fontSize: '24px', fontWeight: '700' }}>
                Check Facts Feature
              </h2>
              <p style={{ margin: 0, color: '#4a5568', fontSize: '16px' }}>
                Verify claims with web-backed evidence and AI-powered analysis
              </p>
            </div>

            {/* Images Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <img 
                  src="/alwrity-fact-check.png" 
                  alt="ALwrity Fact Check Interface"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: 'auto',
                    borderRadius: '8px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    marginBottom: '12px'
                  }}
                />
                <h4 style={{ margin: '0 0 8px 0', color: '#2d3748', fontSize: '16px', fontWeight: '600' }}>
                  ALwrity Fact Check Interface
                </h4>
                <p style={{ margin: 0, color: '#4a5568', fontSize: '14px' }}>
                  Select any text in your content to verify claims
                </p>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <img 
                  src="/fact-check1.png" 
                  alt="Fact Check Results"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: 'auto',
                    borderRadius: '8px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    marginBottom: '12px'
                  }}
                />
                <h4 style={{ margin: '0 0 8px 0', color: '#2d3748', fontSize: '16px', fontWeight: '600' }}>
                  Detailed Fact Check Results
                </h4>
                <p style={{ margin: 0, color: '#4a5568', fontSize: '14px' }}>
                  Get comprehensive analysis with source citations
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'left' }}>
              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                How Fact Checking Works:
              </h3>
              <ol style={{ color: '#4a5568', lineHeight: '1.6', paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Select Text:</strong> Highlight any claim or statement in your content</li>
                <li><strong>AI Analysis:</strong> Our AI extracts key claims and identifies fact-checkable statements</li>
                <li><strong>Web Search:</strong> Search for evidence using Exa.ai and Google Search</li>
                <li><strong>Verification:</strong> Compare claims against reliable sources and evidence</li>
                <li><strong>Results:</strong> Get detailed analysis with confidence scores and source citations</li>
              </ol>

              <h3 style={{ color: '#2d3748', fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
                Key Benefits:
              </h3>
              <ul style={{ color: '#4a5568', lineHeight: '1.6', paddingLeft: '20px', marginBottom: '20px' }}>
                <li>Verify claims before publishing to maintain credibility</li>
                <li>Get source citations for better content transparency</li>
                <li>Identify potentially misleading or false information</li>
                <li>Enhance content quality with evidence-based writing</li>
                <li>Build trust with your audience through verified content</li>
              </ul>

              <button
                onClick={() => {
                  if (onStartQuickCreatePost) {
                    onStartQuickCreatePost();
                  } else {
                    onCloseFactCheckModal();
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Create a post to fact-check →
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
