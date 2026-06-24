import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LinkedInPreferences } from '../utils/storageUtils';
import { PersonaChip } from '../../TextEditor/ContentPreviewHeaderComponents';
import { usePlatformPersonaContext } from '../../shared/PersonaContext/PlatformPersonaProvider';
import HeaderControls from '../../shared/HeaderControls';
import BrainstormFlow from './BrainstormFlow';
import { WatchdogButton } from './WatchdogButton';
// Temporary fix: use require for image import
const alwrityLogo = require('../../../assets/images/alwrity_logo.png');

interface HeaderProps {
  userPreferences: LinkedInPreferences;
  chatHistory: any[];
  showPreferencesModal: boolean;
  onPreferencesModalChange: (show: boolean) => void;
  onPreferencesChange: (prefs: Partial<LinkedInPreferences>) => void;
  hasDraft: boolean;
  onResetDraft: () => void;
  onGeneratePost: (topic: string, context: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  userPreferences,
  chatHistory,
  showPreferencesModal,
  onPreferencesModalChange,
  onPreferencesChange,
  hasDraft,
  onResetDraft,
  onGeneratePost,
}) => {
  const navigate = useNavigate();
  const [personaOverride, setPersonaOverride] = useState<any>(null);
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

  const handlePersonaUpdate = (personaData: any) => {
    console.log('Persona updated in LinkedIn writer:', personaData);
    // setPersonaOverride(personaData);
    // You can also save this to user preferences or pass it up to the parent component
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a66c2 0%, #0056b3 100%)',
      color: 'white',
      padding: '20px 24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left Section - Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Back Button - returns to LinkedIn home (WelcomeMessage) when there's a draft */}
          <button
            onClick={() => hasDraft ? onResetDraft() : navigate('/')}
            style={{
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            title={hasDraft ? 'Back to LinkedIn Home' : 'Back to Home'}
          >
            ← {hasDraft ? 'Back' : 'Home'}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src={alwrityLogo} 
              alt="ALwrity Logo" 
              style={{ 
                height: '36px', 
                width: 'auto',
                filter: 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
              }} 
            />
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '26px', 
                fontWeight: 700,
                letterSpacing: '-0.5px'
              }}>
                ALwrity LinkedIn Assistant
              </h1>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <WatchdogButton onGeneratePost={onGeneratePost} />
            {/* Preferences Button */}
            <div 
              style={{ 
                position: 'relative',
                cursor: 'pointer'
              }}
              onMouseEnter={() => onPreferencesModalChange(true)}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}>
                <span style={{ fontSize: '14px', opacity: 0.9 }}>⚙️</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Preferences</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
              </div>
              
              {/* Preferences Modal */}
              {showPreferencesModal && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    width: '400px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e9ecef',
                    padding: '20px',
                    zIndex: 1000,
                    marginTop: '8px',
                    animation: 'slideIn 0.2s ease-out'
                  }}
                  onMouseEnter={() => onPreferencesModalChange(true)}
                  onMouseLeave={() => onPreferencesModalChange(false)}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#333', fontSize: '16px', fontWeight: 600 }}>
                      Content Preferences & Persona
                    </h4>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
                      <strong>Current Settings:</strong> {userPreferences.tone} tone • {userPreferences.industry || 'Not set'} industry • {chatHistory.length} messages
                    </div>
                  </div>
                  
                  {/* Persona Section */}
                  <div style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    marginBottom: '16px',
                    background: '#f8f9fa'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h5 style={{ margin: 0, color: '#2d3748', fontSize: '14px', fontWeight: '600' }}>
                        Writing Persona
                      </h5>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4a5568' }}>
                          <input
                            type="radio"
                            name="personaEnabled"
                            defaultChecked={true}
                            style={{ margin: 0 }}
                          />
                          On
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4a5568' }}>
                          <input
                            type="radio"
                            name="personaEnabled"
                            style={{ margin: 0 }}
                          />
                          Off
                        </label>
                      </div>
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
                </div>
              )}
            </div>
            
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
