import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { LinkedInPreferences } from '../utils/storageUtils';
import { usePlatformPersonaContext } from '../../shared/PersonaContext/PlatformPersonaProvider';
import HeaderControls from '../../shared/HeaderControls';
import BrainstormFlow from './BrainstormFlow';

import { useLinkedInStudioProfileStrength } from '../hooks/useLinkedInStudioProfileStrength';
import { dispatchLinkedInPersonaUpdated } from '../utils/profileStrengthEvents';
import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';
import { useLinkedInSearch } from '../hooks/useLinkedInSearch';
import { LinkedInSearchBar } from './search/LinkedInSearchBar';
import { LinkedInSearchModal } from './search/LinkedInSearchModal';
import { useMobileHeaderNav } from '../hooks/useMobileHeaderNav';
import { StudioTourTrigger } from './dashboard/StudioTourTrigger';
import { ContentPersonaPreferencesBody } from './ContentPersonaPreferencesBody';
import { DashboardActionModal } from './dashboard/DashboardActionModal';
import { STUDIO_TAB_ACTION_MODAL_CLASS } from './dashboard/dashboardLayoutConstants';

const NAV_TITLE_CLASS = 'linkedin-writer-header-title';
const PERSONA_VOICE_HINT_KEY = 'linkedin_persona_voice_hint_seen';

interface HeaderProps {
  userPreferences: LinkedInPreferences;
  chatHistory: any[];
  showPreferencesModal: boolean;
  onPreferencesModalChange: (show: boolean) => void;
  onPreferencesChange: (prefs: Partial<LinkedInPreferences>) => void;
  hasDraft: boolean;
  onResetDraft: () => void;
  dashboardDraft?: string;
  onResumeDraft?: () => void;
  onClearDraft?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userPreferences,
  chatHistory,
  showPreferencesModal,
  onPreferencesModalChange,
  onPreferencesChange,
  hasDraft,
  onResetDraft,
  dashboardDraft = '',
  onResumeDraft,
  onClearDraft,
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
  const isMobileHeaderNav = useMobileHeaderNav();
  const [showPersonaVoiceHint, setShowPersonaVoiceHint] = useState(() => {
    try {
      return !localStorage.getItem(PERSONA_VOICE_HINT_KEY);
    } catch {
      return false;
    }
  });
  const {
    profileStrengthPercent,
    profileStrengthLoading,
    strengthLabel,
    strengthTooltip,
  } = useLinkedInStudioProfileStrength();
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
    window.dispatchEvent(new CustomEvent('linkedinwriter:openOptimiseProfile'));
  };

  const togglePreferencesPanel = () => {
    if (showPersonaVoiceHint) {
      try {
        localStorage.setItem(PERSONA_VOICE_HINT_KEY, '1');
      } catch {
        // ignore storage errors
      }
      setShowPersonaVoiceHint(false);
    }
    onPreferencesModalChange(!showPreferencesModal);
  };

  /** M-35: hide inactive search strip when LinkedIn is not connected (mobile only). */
  const showMobileSearchRow = isMobileHeaderNav && connected;

  const personaPreferencesBodyProps = {
    userPreferences,
    chatHistory,
    connected,
    profileStrengthPercent,
    strengthLabel,
    strengthTooltip,
    profileStrengthLoading,
    onOptimiseProfile: handleOpenOptimiseProfile,
    onPreferenceChange: handlePreferenceChange,
    onPersonaUpdate: handlePersonaUpdate,
    onClose: () => onPreferencesModalChange(false),
  };

  const personaPreferencesPanel =
    showPreferencesModal &&
    !isMobileHeaderNav &&
    personaPanelPos &&
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: '16px',
          }}
        >
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
        <ContentPersonaPreferencesBody {...personaPreferencesBodyProps} />
        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>,
      document.body,
    );

  const personaMobileModal = showPreferencesModal && isMobileHeaderNav && (
    <DashboardActionModal
      open={showPreferencesModal}
      title="Content Persona"
      onClose={() => onPreferencesModalChange(false)}
      maxWidth="100%"
      maxHeight="min(85dvh, 640px)"
      modalClassName={STUDIO_TAB_ACTION_MODAL_CLASS}
    >
      <ContentPersonaPreferencesBody {...personaPreferencesBodyProps} showProfileStrength={false} />
    </DashboardActionModal>
  );

  const brandBlock = (
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
  );

  const searchBar = (
    <LinkedInSearchBar
      value={linkedInSearch.query}
      onChange={linkedInSearch.setQuery}
      onSearch={() => void linkedInSearch.runSearch()}
      disabled={!connected}
      size={isMobileHeaderNav ? 'mobileStrip' : 'nav'}
    />
  );

  return (
    <div
      className={`linkedin-writer-header${isMobileHeaderNav ? ' linkedin-writer-header--mobile-nav' : ''}`}
    >
      {isMobileHeaderNav ? (
        <>
          <div className="linkedin-writer-header-row linkedin-writer-header-row--nav">
            {brandBlock}
            <div className="linkedin-writer-header-nav-actions">
              <StudioTourTrigger variant="headerNav" />
              <HeaderControls
                colorMode="light"
                showPlanChip={false}
                gap={1}
              />
            </div>
          </div>

          <div className="linkedin-writer-header-mobile-stack">
            {showMobileSearchRow && (
              <div className="linkedin-writer-header-search-row">{searchBar}</div>
            )}
          </div>
        </>
      ) : (
        <div className="linkedin-writer-header-row">
          {brandBlock}

          <div className="linkedin-writer-header-center">
            <div ref={personaDropdownRef} className="linkedin-writer-header-persona">
              <button
                ref={personaButtonRef}
                type="button"
                className="linkedin-writer-header-pill-btn"
                title="Content Persona — Set your writing voice"
                aria-expanded={showPreferencesModal}
                aria-haspopup="dialog"
                onClick={togglePreferencesPanel}
              >
                <span className="linkedin-writer-header-pill-icon" aria-hidden>
                  ⚙️
                </span>
                <span className="linkedin-writer-header-pill-label">Content Persona</span>
              </button>
            </div>
          </div>

          <div className="linkedin-writer-header-right">
            <div className="linkedin-writer-header-search-slot">{searchBar}</div>
            <div className="linkedin-writer-header-icon-cluster">
              <HeaderControls colorMode="light" gap={1} />
            </div>
          </div>
        </div>
      )}

      {personaPreferencesPanel}
      {personaMobileModal}
      
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
