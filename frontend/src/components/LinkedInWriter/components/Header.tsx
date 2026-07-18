import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  dispatchProfileStrengthUpdated,
  dispatchLinkedInPersonaUpdated,
  type ProfileStrengthUpdatedDetail,
} from '../utils/profileStrengthEvents';
import { getLinkedInProfileFoundation } from '../../../api/linkedinSocial';
import type { LinkedInProfileValidation } from '../../../api/linkedinSocial';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { useLinkedInSearch } from '../hooks/useLinkedInSearch';
import { LinkedInSearchBar } from './search/LinkedInSearchBar';
import { LinkedInSearchModal } from './search/LinkedInSearchModal';

const NAV_TITLE_CLASS = 'linkedin-writer-header-title';

interface HeaderProps {
  userPreferences: LinkedInPreferences;
  chatHistory: any[];
  showPreferencesModal: boolean;
  onPreferencesModalChange: (show: boolean) => void;
  onPreferencesChange: (prefs: Partial<LinkedInPreferences>) => void;
  hasDraft: boolean;
  onResetDraft: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userPreferences,
  chatHistory,
  showPreferencesModal,
  onPreferencesModalChange,
  onPreferencesChange,
  hasDraft,
  onResetDraft,
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
  const linkedInSearch = useLinkedInSearch({ connected });
  const [profileStrengthPercent, setProfileStrengthPercent] = useState<number | null>(null);
  const [profileValidation, setProfileValidation] = useState<LinkedInProfileValidation | null>(
    null
  );
  const [profileStrengthLoading, setProfileStrengthLoading] = useState(false);
  const { corePersona, platformPersona } = usePlatformPersonaContext();

  // Broadcast persona snapshot to global components (e.g. UserBadge) that cannot
  // call usePlatformPersonaContext() directly because they live outside the provider.
  useEffect(() => {
    if (!corePersona) return;
    dispatchLinkedInPersonaUpdated({
      personaName: corePersona.persona_name,
      archetype: corePersona.archetype,
      coreBelief: corePersona.core_belief ?? null,
      defaultTone: platformPersona?.tonal_range?.default_tone ?? null,
    });
  }, [corePersona, platformPersona]);

  // BrainstormFlow state management
  const [brainstormVisible, setBrainstormVisible] = useState(false);

  const handlePreferenceChange = (key: keyof LinkedInPreferences, value: any) => {
    onPreferencesChange({ [key]: value });
  };

  useEffect(() => {
    const onOpenPreferences = () => onPreferencesModalChange(true);

    window.addEventListener('linkedinwriter:openPreferences', onOpenPreferences);
    return () => {
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
          const validation = data.profile_validation ?? null;
          setProfileValidation(validation);
          setProfileStrengthPercent(getDisplayProfileStrengthPercent(validation));
          // Broadcast validation + AI intelligence so subscribers (e.g. UserBadge) never
          // need a separate API call for either piece of profile data.
          if (validation) {
            dispatchProfileStrengthUpdated(validation, data.ai_profile_intelligence ?? null);
          }
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
    if (!connected) return;
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
    >
      <div className="linkedin-writer-header-row">
        <div className="linkedin-writer-header-brand">
          <button
            type="button"
            className="linkedin-writer-header-brand-logo"
            onClick={handleLogoClick}
            title={hasDraft ? 'Back to LinkedIn Dashboard' : 'LinkedIn Studio home'}
            aria-label={hasDraft ? 'Back to LinkedIn Dashboard' : 'LinkedIn Studio home'}
          >
            <img src="/alwrity-icon.png" alt="ALwrity" />
          </button>
          <h1 className={NAV_TITLE_CLASS}>
            <span className="linkedin-writer-header-brand-line">LinkedIn</span>
            <span className="linkedin-writer-header-brand-subline">Studio</span>
          </h1>
        </div>

        <div className="linkedin-writer-header-center">
          <OptimiseProfileControl
            onOptimiseProfile={handleOpenOptimiseProfile}
            profileStrengthPercent={connected ? profileStrengthPercent : null}
            strengthLabel={strengthLabel}
            strengthTooltip={connected ? strengthTooltip : 'Connect LinkedIn to optimise your profile'}
            isLoading={profileStrengthLoading}
            isDisabled={!connected}
            variant="ticker"
          />
          <div
            ref={personaDropdownRef}
            className="linkedin-writer-header-persona"
          >
            <button
              ref={personaButtonRef}
              type="button"
              className="linkedin-writer-header-pill-btn"
              title="Set tone, industry, audience, and writing persona"
              aria-expanded={showPreferencesModal}
              aria-haspopup="dialog"
              onClick={togglePreferencesPanel}
            >
              <span className="linkedin-writer-header-pill-icon" aria-hidden>⚙️</span>
              <span className="linkedin-writer-header-pill-label">
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
                        onClick={() => { onPreferencesModalChange(false); window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm')); }}
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

        <div className="linkedin-writer-header-right">
          <LinkedInSearchBar
            value={linkedInSearch.query}
            onChange={linkedInSearch.setQuery}
            onSearch={() => void linkedInSearch.runSearch()}
            disabled={!connected}
            connected={connected}
            size="nav"
          />
          <HeaderControls colorMode="light" gap={1} />
        </div>
      </div>
      
      {/* LinkedIn Search modal */}
      <LinkedInSearchModal
        open={linkedInSearch.modalOpen}
        query={linkedInSearch.query}
        category={linkedInSearch.category}
        items={linkedInSearch.items}
        loading={linkedInSearch.loading}
        loadingMore={linkedInSearch.loadingMore}
        error={linkedInSearch.error}
        errorType={linkedInSearch.errorType}
        paging={linkedInSearch.paging}
        hasSearched={linkedInSearch.hasSearched}
        onClose={linkedInSearch.closeModal}
        onCategoryChange={linkedInSearch.setCategory}
        onLoadMore={() => void linkedInSearch.loadMore()}
        onConnectClick={() => void connectWithOAuth()}
        loadMoreEnabled={
          Boolean(linkedInSearch.cursor) &&
          !linkedInSearch.loading &&
          !linkedInSearch.loadingMore
        }
      />

      {/* BrainstormFlow Component */}
      <BrainstormFlow
        brainstormVisible={brainstormVisible}
        setBrainstormVisible={setBrainstormVisible}
        onBackToOptions={() => { setBrainstormVisible(false); window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm')); }}
      />
    </div>
  );
};
