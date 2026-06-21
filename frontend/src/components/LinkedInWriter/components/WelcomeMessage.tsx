import React, { useState } from 'react';
import { FeatureCarousel } from './FeatureCarousel';
import { LinkedInConnectionPlaceholder } from './LinkedInConnectionPlaceholder';
import { InfoModals } from './InfoModals';
import { QuickCreate } from './QuickCreate';
import { LinkedInPreferences } from '../utils/storageUtils';

interface WelcomeMessageProps {
  draft: string;
  isGenerating: boolean;
  onGeneratePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateArticle: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateCarousel: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  onGenerateVideoScript: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  userPreferences: LinkedInPreferences;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  draft,
  isGenerating,
  onGeneratePost,
  onGenerateArticle,
  onGenerateCarousel,
  onGenerateVideoScript,
  userPreferences
}) => {
  const [showCopilotModal, setShowCopilotModal] = useState(false);
  const [showAssistiveModal, setShowAssistiveModal] = useState(false);
  const [showFactCheckModal, setShowFactCheckModal] = useState(false);

  if (draft || isGenerating) return null;

  const handleOpenCopilot = () => {
    // Find and click the Copilot sidebar button
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
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '24px',
      color: '#666',
      overflowY: 'auto',
      maxHeight: '100vh'
    }}>
      {/* LinkedIn connection status */}
      <LinkedInConnectionPlaceholder />

      {/* Icon and Buttons Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Chat/Write with ALwrity Copilot Button with Help Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={handleOpenCopilot}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
              backgroundSize: '200% 200%',
              border: 'none',
              borderRadius: '16px',
              padding: '18px 32px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              boxShadow: `
                0 12px 35px rgba(102, 126, 234, 0.4),
                0 6px 20px rgba(118, 75, 162, 0.3),
                0 2px 8px rgba(0, 0, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
              `,
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              position: 'relative',
              overflow: 'hidden',
              minWidth: '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              transform: 'translateY(0)',
              filter: 'brightness(1) saturate(1.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px) scale(1.05)';
              e.currentTarget.style.boxShadow = `
                0 20px 50px rgba(102, 126, 234, 0.6),
                0 12px 30px rgba(118, 75, 162, 0.4),
                0 4px 15px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.3),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
              `;
              e.currentTarget.style.filter = 'brightness(1.1) saturate(1.2)';
              e.currentTarget.style.backgroundPosition = '100% 0%';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = `
                0 12px 35px rgba(102, 126, 234, 0.4),
                0 6px 20px rgba(118, 75, 162, 0.3),
                0 2px 8px rgba(0, 0, 0, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.2),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
              `;
              e.currentTarget.style.filter = 'brightness(1) saturate(1.1)';
              e.currentTarget.style.backgroundPosition = '0% 0%';
            }}
            title="Open ALwrity Copilot for comprehensive AI assistance with content creation, editing, and research"
          >
            {/* Play Icon */}
            <div style={{
              width: '18px',
              height: '18px',
              background: 'white',
              clipPath: 'polygon(0 0, 0 100%, 100% 50%)',
              marginRight: '10px',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              transform: 'translateX(2px)'
            }} />
            <span>Chat/Write with ALwrity Copilot</span>
          </button>
          
          {/* Help Icon */}
          <button
            onClick={() => setShowCopilotModal(true)}
            style={{
              background: 'rgba(102, 126, 234, 0.1)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#667eea',
              fontSize: '16px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Learn more about ALwrity Copilot"
          >
            ?
          </button>
        </div>

        {/* ALwrity Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'float 3s ease-in-out infinite'
        }}>
          <img 
            src="/AskAlwrity-min.ico" 
            alt="ALwrity" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: 0.8
            }}
          />
        </div>

        {/* Write with Assistive Research Button */}
        <button 
          onClick={() => setShowAssistiveModal(true)}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #f093fb 100%)',
            backgroundSize: '200% 200%',
            border: 'none',
            borderRadius: '16px',
            padding: '18px 32px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            cursor: 'pointer',
            boxShadow: `
              0 12px 35px rgba(240, 147, 251, 0.4),
              0 6px 20px rgba(245, 87, 108, 0.3),
              0 2px 8px rgba(0, 0, 0, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `,
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            position: 'relative',
            overflow: 'hidden',
            minWidth: '240px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            transform: 'translateY(0)',
            filter: 'brightness(1) saturate(1.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.05)';
            e.currentTarget.style.boxShadow = `
              0 20px 50px rgba(240, 147, 251, 0.6),
              0 12px 30px rgba(245, 87, 108, 0.4),
              0 4px 15px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.3),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `;
            e.currentTarget.style.filter = 'brightness(1.1) saturate(1.2)';
            e.currentTarget.style.backgroundPosition = '100% 0%';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = `
              0 12px 35px rgba(240, 147, 251, 0.4),
              0 6px 20px rgba(245, 87, 108, 0.3),
              0 2px 8px rgba(0, 0, 0, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `;
            e.currentTarget.style.filter = 'brightness(1) saturate(1.1)';
            e.currentTarget.style.backgroundPosition = '0% 0%';
          }}
          title="Enable real-time AI writing assistance with contextual suggestions and research-backed content"
        >
          {/* Play Icon */}
          <div style={{
            width: '18px',
            height: '18px',
            background: 'white',
            clipPath: 'polygon(0 0, 0 100%, 100% 50%)',
            marginRight: '10px',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            transform: 'translateX(2px)'
          }} />
          <span>Write with Assistive Research</span>
        </button>
      </div>

      <p style={{
        margin: '0 0 24px 0',
        color: '#666', 
        fontSize: '16px',
        lineHeight: '1.6',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        Choose your preferred AI assistance mode to get started with content creation.
      </p>

      {/* Quick Create - Direct generation buttons */}
      <div style={{ width: '100%', maxWidth: 640, marginBottom: 24 }}>
        <QuickCreate
          onGeneratePost={onGeneratePost}
          onGenerateArticle={onGenerateArticle}
          onGenerateCarousel={onGenerateCarousel}
          onGenerateVideoScript={onGenerateVideoScript}
          userPreferences={userPreferences}
        />
      </div>

      {/* Feature carousel — moved below Quick Create */}
      <FeatureCarousel
        onFactCheckClick={() => setShowFactCheckModal(true)}
        onCopilotClick={() => setShowCopilotModal(true)}
      />

      {/* Info Modals */}
      <InfoModals
        showCopilotModal={showCopilotModal}
        showAssistiveModal={showAssistiveModal}
        showFactCheckModal={showFactCheckModal}
        onCloseCopilotModal={() => setShowCopilotModal(false)}
        onCloseAssistiveModal={() => setShowAssistiveModal(false)}
        onCloseFactCheckModal={() => setShowFactCheckModal(false)}
        onOpenCopilot={handleOpenCopilot}
      />


        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
          }
        `}</style>
    </div>
  );
};
