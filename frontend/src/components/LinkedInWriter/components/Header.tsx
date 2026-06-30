import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { LinkedInPreferences } from '../utils/storageUtils';
import { PersonaChip } from '../../TextEditor/ContentPreviewHeaderComponents';
import { usePlatformPersonaContext } from '../../shared/PersonaContext/PlatformPersonaProvider';
import HeaderControls from '../../shared/HeaderControls';
import BrainstormFlow from './BrainstormFlow';
import { OptimiseProfileControl } from './dashboard/OptimiseProfileControl';
import {
  getDisplayProfileStrengthPercent,
  getProfileStrengthDisplayLabel,
  getProfileStrengthTooltip,
} from '../utils/profileStrengthUtils';
import {
  PROFILE_STRENGTH_UPDATED_EVENT,
  type ProfileStrengthUpdatedDetail,
} from '../utils/profileStrengthEvents';
import { getLinkedInProfileFoundation } from '../../../api/linkedinSocial';
import type { LinkedInProfileValidation } from '../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';

const NAV_BG = '#BCE0FD';
const NAV_TITLE_COLOR = '#0a66c2';

interface HeaderProps {
  userPreferences: LinkedInPreferences;
  chatHistory: any[];
  showPreferencesModal: boolean;
  onPreferencesModalChange: (show: boolean) => void;
  onPreferencesChange: (prefs: Partial<LinkedInPreferences>) => void;
  hasDraft: boolean;
  onResetDraft: () => void;
  generatePost: (params?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}

export const Header: React.FC<HeaderProps> = ({
  userPreferences,
  chatHistory,
  showPreferencesModal,
  onPreferencesModalChange,
  onPreferencesChange,
  hasDraft,
  onResetDraft,
  generatePost,
}) => {
  const personaDropdownRef = useRef<HTMLDivElement>(null);
  const personaButtonRef = useRef<HTMLButtonElement>(null);
  const personaPanelRef = useRef<HTMLDivElement>(null);
  const [personaPanelPos, setPersonaPanelPos] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const { connected, connectWithOAuth } = useLinkedInSocialConnection();
  const [profileStrengthPercent, setProfileStrengthPercent] = useState<number | null>(null);
  const [profileValidation, setProfileValidation] = useState<LinkedInProfileValidation | null>(
    null
  );
  const [profileStrengthLoading, setProfileStrengthLoading] = useState(false);
  const { corePersona, platformPersona } = usePlatformPersonaContext();
  
  // Brainstorm modal state
  const [showBrainstormModal, setShowBrainstormModal] = useState(false);
  const [seed, setSeed] = useState('');
  const [usePersona, setUsePersona] = useState(true);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);
  const [includeTrending, setIncludeTrending] = useState(false);
  const [remarketContent, setRemarketContent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aiSearchPrompt, setAiSearchPrompt] = useState('');

  // BrainstormFlow state management
  const [brainstormVisible, setBrainstormVisible] = useState(false);
  const [brainstormStage, setBrainstormStage] = useState<'loading' | 'select' | 'results'>('loading');
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);
  const [aiSearchPrompts, setAiSearchPrompts] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<{ prompt: string; rationale?: string }[]>([]);
  const [isUsingCache, setIsUsingCache] = useState(false);

  // Check if there are cached brainstorm ideas
  const hasCachedIdeas = useMemo(() => {
    try {
      const keys = Object.keys(sessionStorage);
      return keys.some(key => {
        if (key.startsWith('brainstorm_ideas_')) {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const data = JSON.parse(cached);
            // Check if cache is less than 1 hour old and has ideas
            return Date.now() - data.timestamp < 3600000 && data.ideas && data.ideas.length > 0;
          }
        }
        return false;
      });
    } catch (e) {
      return false;
    }
  }, [showBrainstormModal]); // Re-check when modal opens

  const handlePreferenceChange = (key: keyof LinkedInPreferences, value: any) => {
    onPreferencesChange({ [key]: value });
  };

  useEffect(() => {
    const onOpenBrainstorm = () => setShowBrainstormModal(true);
    const onOpenBrainstormRemarket = () => {
      setRemarketContent(true);
      setShowBrainstormModal(true);
    };
    const onOpenPreferences = () => onPreferencesModalChange(true);

    window.addEventListener('linkedinwriter:openBrainstorm', onOpenBrainstorm);
    window.addEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
    window.addEventListener('linkedinwriter:openPreferences', onOpenPreferences);
    return () => {
      window.removeEventListener('linkedinwriter:openBrainstorm', onOpenBrainstorm);
      window.removeEventListener('linkedinwriter:openBrainstormRemarket', onOpenBrainstormRemarket);
      window.removeEventListener('linkedinwriter:openPreferences', onOpenPreferences);
    };
  }, [onPreferencesModalChange]);

  useEffect(() => {
    if (!showPreferencesModal) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (personaDropdownRef.current?.contains(target)) return;
      if (personaPanelRef.current?.contains(target)) return;
      onPreferencesModalChange(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPreferencesModal, onPreferencesModalChange]);

  useLayoutEffect(() => {
    if (!showPreferencesModal || !personaButtonRef.current) {
      setPersonaPanelPos(null);
      return;
    }

    const updatePosition = () => {
      const button = personaButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const panelWidth = 400;
      const left = Math.min(
        Math.max(16, rect.left + rect.width / 2 - panelWidth / 2),
        window.innerWidth - panelWidth - 16
      );
      const top = rect.bottom + 8;
      const maxHeight = Math.max(240, window.innerHeight - top - 16);
      setPersonaPanelPos({ top, left, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showPreferencesModal]);

  useEffect(() => {
    if (!connected) {
      setProfileStrengthPercent(null);
      setProfileValidation(null);
      setProfileStrengthLoading(false);
      return;
    }

    let cancelled = false;
    setProfileStrengthLoading(true);

    getLinkedInProfileFoundation()
      .then((data) => {
        if (!cancelled) {
          setProfileValidation(data.profile_validation ?? null);
          setProfileStrengthPercent(getDisplayProfileStrengthPercent(data.profile_validation));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileStrengthPercent(null);
          setProfileValidation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileStrengthLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ProfileStrengthUpdatedDetail>).detail;
      if (detail?.profileValidation) {
        setProfileValidation(detail.profileValidation);
        setProfileStrengthPercent(getDisplayProfileStrengthPercent(detail.profileValidation));
      }
    };
    window.addEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROFILE_STRENGTH_UPDATED_EVENT, handler);
  }, []);

  const handlePersonaUpdate = (personaData: any) => {
    console.log('Persona updated in LinkedIn writer:', personaData);
    // setPersonaOverride(personaData);
    // You can also save this to user preferences or pass it up to the parent component
  };

  const handleLogoClick = () => {
    if (hasDraft) {
      onResetDraft();
    }
  };

  const handleOpenOptimiseProfile = () => {
    if (!connected) {
      void connectWithOAuth();
      return;
    }
    window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
  };

  const strengthLabel = getProfileStrengthDisplayLabel(profileValidation, profileStrengthPercent);
  const strengthTooltip = getProfileStrengthTooltip(profileValidation);

  const togglePreferencesPanel = () => {
    onPreferencesModalChange(!showPreferencesModal);
  };

  return (
    <div
      className="linkedin-writer-header"
      style={{
        background: NAV_BG,
        color: '#1a1a2e',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(10, 102, 194, 0.12)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="linkedin-writer-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {/* Left — logo (home) + product title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            onClick={handleLogoClick}
            title={hasDraft ? 'Back to LinkedIn Dashboard' : 'LinkedIn Studio home'}
            aria-label={hasDraft ? 'Back to LinkedIn Dashboard' : 'LinkedIn Studio home'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              background: '#ffffff',
              border: '1px solid rgba(10, 102, 194, 0.15)',
              borderRadius: 8,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
            }}
          >
            <img
              src="/alwrity-icon.png"
              alt="ALwrity"
              style={{ height: 36, width: 36, objectFit: 'contain' }}
            />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.3px',
                color: NAV_TITLE_COLOR,
                lineHeight: 1.2,
              }}
            >
              LinkedIn Studio
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontStyle: 'italic',
                color: '#1a1a2e',
                lineHeight: 1.3,
              }}
            >
              ALwrity
            </p>
          </div>
        </div>

        {/* Center — tools & content settings */}
        <div className="linkedin-writer-header-center" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
          <OptimiseProfileControl
            onOptimiseProfile={handleOpenOptimiseProfile}
            profileStrengthPercent={connected ? profileStrengthPercent : null}
            strengthLabel={strengthLabel}
            strengthTooltip={connected ? strengthTooltip : undefined}
            isLoading={profileStrengthLoading}
            variant="ticker"
          />
          <div
            ref={personaDropdownRef}
            style={{
              position: 'relative',
            }}
          >
            <button
              ref={personaButtonRef}
              type="button"
              title="Set tone, industry, audience, and writing persona"
              aria-expanded={showPreferencesModal}
              aria-haspopup="dialog"
              onClick={togglePreferencesPanel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#ffffff',
                borderRadius: 24,
                border: '1px solid rgba(10, 102, 194, 0.35)',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, color: NAV_TITLE_COLOR, opacity: 0.9 }} aria-hidden>⚙️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAV_TITLE_COLOR }}>
                Content Persona
              </span>
            </button>
              {showPreferencesModal && personaPanelPos &&
                createPortal(
                <div 
                  ref={personaPanelRef}
                  role="dialog"
                  aria-label="Content persona settings"
                  style={{
                    position: 'fixed',
                    top: personaPanelPos.top,
                    left: personaPanelPos.left,
                    width: 400,
                    maxWidth: 'min(400px, calc(100vw - 32px))',
                    maxHeight: personaPanelPos.maxHeight,
                    overflowY: 'auto',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e9ecef',
                    padding: '20px',
                    zIndex: 10050,
                    animation: 'slideIn 0.2s ease-out',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#333', fontSize: '16px', fontWeight: 600 }}>
                      Content Preferences & Persona
                    </h4>
                    <button
                      type="button"
                      onClick={() => onPreferencesModalChange(false)}
                      aria-label="Close content persona settings"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 22,
                        lineHeight: 1,
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: 2,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                    <strong>Current Settings:</strong> {userPreferences.tone} tone • {userPreferences.industry || 'Not set'} industry • {chatHistory.length} messages
                  </div>
                  {/* Persona Section */}
                  <div style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    marginBottom: '16px',
                    background: '#f8f9fa'
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <h5 style={{ margin: 0, color: '#2d3748', fontSize: '14px', fontWeight: '600' }}>
                        Writing Persona
                      </h5>
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
                        Persona is applied when available. Click the persona chip below to edit your writing style.
                      </p>
                    </div>
                    
                    {/* Interactive Persona Chip */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      padding: '12px',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <PersonaChip 
                        platform="linkedin" 
                        onPersonaUpdate={handlePersonaUpdate}
                      />
                    </div>
                    
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '11px', 
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      Click persona to edit writing style, tone, and preferences
                    </div>
                  </div>
                  
                  {/* Preferences Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Tone</div>
                      <select
                        value={userPreferences.tone}
                        onChange={(e) => handlePreferenceChange('tone', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          background: '#f8f9fa',
                          fontSize: '12px'
                        }}
                      >
                        <option>Professional</option>
                        <option>Casual</option>
                        <option>Thought Leadership</option>
                        <option>Conversational</option>
                        <option>Technical</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Industry</div>
                      <input
                        value={userPreferences.industry}
                        onChange={(e) => handlePreferenceChange('industry', e.target.value)}
                        placeholder="e.g., Technology"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          background: '#f8f9fa',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Target Audience</div>
                      <input
                        value={userPreferences.target_audience}
                        onChange={(e) => handlePreferenceChange('target_audience', e.target.value)}
                        placeholder="e.g., Product Managers"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          background: '#f8f9fa',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Writing Style</div>
                      <select
                        value={userPreferences.writing_style}
                        onChange={(e) => handlePreferenceChange('writing_style', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: 4,
                          background: '#f8f9fa',
                          fontSize: '12px'
                        }}
                      >
                        <option>Clear and Concise</option>
                        <option>Storytelling</option>
                        <option>Analytical</option>
                        <option>Persuasive</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Checkboxes */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={userPreferences.hashtag_preferences}
                        onChange={(e) => handlePreferenceChange('hashtag_preferences', e.target.checked)}
                        style={{ margin: 0 }}
                      />
                      Include Hashtags
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={userPreferences.cta_preferences}
                        onChange={(e) => handlePreferenceChange('cta_preferences', e.target.checked)}
                        style={{ margin: 0 }}
                      />
                      Include Call-to-Action
                    </label>
                  </div>
                  
                  {/* Current Context Display */}
                  <div style={{ 
                    borderTop: '1px solid #e9ecef', 
                    paddingTop: '12px',
                    fontSize: '11px'
                  }}>
                    <div style={{ marginBottom: '8px', fontWeight: 600, color: '#333' }}>Current Context:</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {userPreferences.tone && (
                        <span style={{
                          background: '#e3f2fd',
                          color: '#1976d2',
                          padding: '2px 6px',
                          borderRadius: 8,
                          fontSize: '10px'
                        }}>
                          {userPreferences.tone}
                        </span>
                      )}
                      {userPreferences.industry && (
                        <span style={{
                          background: '#f3e5f5',
                          color: '#7b1fa2',
                          padding: '2px 6px',
                          borderRadius: 8,
                          fontSize: '10px'
                        }}>
                          {userPreferences.industry}
                        </span>
                      )}
                      {userPreferences.target_audience && (
                        <span style={{
                          background: '#e8f5e8',
                          color: '#388e3c',
                          padding: '2px 6px',
                          borderRadius: 8,
                          fontSize: '10px'
                        }}>
                          {userPreferences.target_audience}
                        </span>
                      )}
                      <span style={{
                        background: '#fff3e0',
                        color: '#f57c00',
                        padding: '2px 6px',
                        borderRadius: 8,
                        fontSize: '10px'
                      }}>
                        {chatHistory.length} messages
                      </span>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '12px', marginTop: '12px' }}>
                    <div style={{ marginBottom: '8px', fontWeight: 600, color: '#333', fontSize: '12px' }}>Quick Actions</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { onPreferencesModalChange(false); window.dispatchEvent(new CustomEvent('linkedinwriter:showTodaysTasks')); }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: '#f8f9fa',
                          color: '#333',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#0a66c2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        title="View today's tasks"
                      >
                        📅 Today's Tasks
                      </button>
                      <button
                        onClick={() => { onPreferencesModalChange(false); setShowBrainstormModal(true); }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: '#f8f9fa',
                          color: '#333',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#0a66c2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        title="Brainstorm content ideas"
                      >
                        💡 Brainstorm Ideas
                      </button>
                    </div>
                  </div>

                  <style>{`
                    @keyframes slideIn {
                      from { opacity: 0; transform: translateY(-10px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>
                </div>,
                document.body
              )}
          </div>
        </div>

        <div className="linkedin-writer-header-controls" style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <HeaderControls colorMode="light" showAlerts={true} showUser={true} />
        </div>
      </div>
      
      {/* Initial Brainstorm Modal */}
      {showBrainstormModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'white', width: 720, maxWidth: '92vw', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, #0a66c2 0%, #125ea2 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Brainstorm LinkedIn Content Ideas</div>
              <button onClick={() => setShowBrainstormModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
              <div>
                <div style={{ marginBottom: 10, fontWeight: 700, color: '#1f2937' }}>Options</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 10, 
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Use your personalized writing persona to generate content that matches your unique voice, tone, and style preferences."
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0a66c2';
                      e.currentTarget.style.backgroundColor = '#f8f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={usePersona} 
                      onChange={(e) => setUsePersona(e.target.checked)}
                      style={{ 
                        accentColor: '#0a66c2',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>Use Persona</div>
                  </label>

                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 10, 
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Enable Google Search to find current, relevant information and trending topics for your content ideas."
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0a66c2';
                      e.currentTarget.style.backgroundColor = '#f8f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={useGoogleSearch} 
                      onChange={(e) => setUseGoogleSearch(e.target.checked)}
                      style={{ 
                        accentColor: '#0a66c2',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>Google Search</div>
                  </label>

                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 10, 
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Include trending topics and current events to make your content more timely and engaging."
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0a66c2';
                      e.currentTarget.style.backgroundColor = '#f8f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={includeTrending} 
                      onChange={(e) => setIncludeTrending(e.target.checked)}
                      style={{ 
                        accentColor: '#0a66c2',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>Trending Topics</div>
                  </label>

                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 10, 
                      padding: '10px 12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Repurpose and remarket your existing high-performing content into new formats and angles."
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0a66c2';
                      e.currentTarget.style.backgroundColor = '#f8f9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={remarketContent} 
                      onChange={(e) => setRemarketContent(e.target.checked)}
                      style={{ 
                        accentColor: '#0a66c2',
                        transform: 'scale(1.1)'
                      }}
                    />
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>Remarket Content</div>
                  </label>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, color: '#1f2937' }}>Idea Seed (optional)</div>
                  </div>
                  <textarea
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder={corePersona?.core_belief ? `Ex: Show how "${corePersona.core_belief}" applies to SMB founders this quarter` : 'Add a theme, problem, or audience'}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Alwrity It requires Google Search enabled and an idea seed with at least 4 words.
                    </div>
                    <button
                      onClick={() => {
                        const words = (seed || '').trim().split(/\s+/).filter(Boolean);
                        if (!useGoogleSearch || words.length < 4) return;
                        const personaLine = corePersona ? `${corePersona.persona_name} (${corePersona.archetype})` : 'the user\'s writing persona';
                        const tone = platformPersona?.tonal_range?.default_tone || 'professional';
                        const goTo = corePersona?.linguistic_fingerprint?.lexical_features?.go_to_words?.slice(0,5)?.join(', ');
                        const platformHints = platformPersona ? `Respect LinkedIn constraints like character limits and engagement patterns.` : '';
                        const trending = includeTrending ? 'Blend industry trending topics.' : '';
                        const repurpose = remarketContent ? 'Consider repurposing top-performing content into new angles.' : '';
                        const prompt = `You are an expert LinkedIn content strategist writing in a ${tone} tone for ${personaLine}. Generate a list of highly-relevant, specific topic ideas based on this seed: "${seed}". Prioritize originality, practical value, and thought leadership. ${platformHints} ${trending} ${repurpose} Use current (2024–2025) language and avoid generic suggestions.`.trim();
                        setAiSearchPrompt(prompt);
                        setShowConfirm(true);
                      }}
                      disabled={!(useGoogleSearch && (seed || '').trim().split(/\s+/).filter(Boolean).length >= 4)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0a66c2', background: useGoogleSearch && (seed || '').trim().split(/\s+/).filter(Boolean).length >= 4 ? '#0a66c2' : '#c7d2fe', color: 'white', fontWeight: 800, cursor: useGoogleSearch && (seed || '').trim().split(/\s+/).filter(Boolean).length >= 4 ? 'pointer' : 'not-allowed' }}
                    >
                      Alwrity It
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => {
                      if (hasCachedIdeas) {
                        window.dispatchEvent(new CustomEvent('linkedinwriter:runGoogleSearchForIdeas', { 
                          detail: { prompt: 'View cached ideas', seed: 'cached', forceRefresh: false } 
                        }));
                      } else {
                        window.dispatchEvent(new CustomEvent('linkedinwriter:runGoogleSearchForIdeas', { 
                          detail: { usePersona, useGoogleSearch, includeTrending, remarketContent, seed } 
                        }));
                      }
                      setShowBrainstormModal(false);
                      setBrainstormVisible(true);
                    }}
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: 8, 
                      background: hasCachedIdeas ? '#0a66c2' : '#6b7280', 
                      color: 'white', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontWeight: 800,
                      fontSize: 14
                    }}
                  >
                    {hasCachedIdeas ? 'View Previous Ideas' : 'Generate Ideas'}
                  </button>
                </div>

                {/* Suggestions Section */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>💡 Suggestions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => setSeed('AI and automation trends in 2024')}
                      style={{
                        padding: '8px 12px',
                        background: '#f8f9ff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#374151',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#0a66c2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8f9ff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      🤖 AI and automation trends
                    </button>
                    <button
                      onClick={() => setSeed('Remote work productivity tips')}
                      style={{
                        padding: '8px 12px',
                        background: '#f8f9ff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#374151',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#0a66c2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8f9ff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      🏠 Remote work productivity
                    </button>
                    <button
                      onClick={() => setSeed('Leadership lessons from failures')}
                      style={{
                        padding: '8px 12px',
                        background: '#f8f9ff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#374151',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#0a66c2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8f9ff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      🎯 Leadership lessons
                    </button>
                    <button
                      onClick={() => setSeed('Industry insights and predictions')}
                      style={{
                        padding: '8px 12px',
                        background: '#f8f9ff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: '#374151',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#0a66c2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8f9ff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      📈 Industry insights
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {hasCachedIdeas ? 'You have previously generated ideas. Click "View Previous Ideas" to see them.' : 'These settings guide idea generation. You can fine-tune results in the editor.'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowBrainstormModal(false)} style={{ padding: '10px 16px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for AI Search Prompt */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div style={{ background: 'white', width: 680, maxWidth: '92vw', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', background: '#0a66c2', color: 'white', fontWeight: 800 }}>Confirm Google Search Prompt</div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>We crafted this AI prompt using your persona and seed. Review and confirm to run Google Search for topic ideas.</div>
              <textarea value={aiSearchPrompt} onChange={(e) => setAiSearchPrompt(e.target.value)} rows={6} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13 }} />
            </div>
            <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f9fafb' }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 700 }}>Back</button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('linkedinwriter:runGoogleSearchForIdeas', { detail: { prompt: aiSearchPrompt, seed, usePersona, includeTrending, remarketContent } }));
                  setShowConfirm(false);
                  setShowBrainstormModal(false);
                  setBrainstormVisible(true);
                }}
                style={{ padding: '8px 12px', borderRadius: 8, background: '#0a66c2', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                Run Google Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BrainstormFlow Component */}
      <BrainstormFlow
        brainstormVisible={brainstormVisible}
        setBrainstormVisible={setBrainstormVisible}
        brainstormStage={brainstormStage}
        setBrainstormStage={setBrainstormStage}
        loaderMessageIndex={loaderMessageIndex}
        setLoaderMessageIndex={setLoaderMessageIndex}
        aiSearchPrompts={aiSearchPrompts}
        setAiSearchPrompts={setAiSearchPrompts}
        selectedPrompt={selectedPrompt}
        setSelectedPrompt={setSelectedPrompt}
        searchResults={searchResults}
        setSearchResults={setSearchResults}
        ideas={ideas}
        setIdeas={setIdeas}
        isUsingCache={isUsingCache}
        setIsUsingCache={setIsUsingCache}
      />
    </div>
  );
};
