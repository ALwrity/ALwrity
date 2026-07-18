import React from 'react';
import { PersonaChip } from '../../TextEditor/ContentPreviewHeaderComponents';
import { LinkedInPreferences } from '../utils/storageUtils';
import { OptimiseProfileControl } from './dashboard/OptimiseProfileControl';

interface ContentPersonaPreferencesBodyProps {
  userPreferences: LinkedInPreferences;
  chatHistory: unknown[];
  connected: boolean;
  profileStrengthPercent: number | null;
  strengthLabel: string;
  strengthTooltip: string;
  profileStrengthLoading: boolean;
  onOptimiseProfile: () => void;
  onPreferenceChange: (key: keyof LinkedInPreferences, value: unknown) => void;
  onPersonaUpdate: (personaData: unknown) => void;
  onClose: () => void;
  /** Hide profile strength row on mobile — Optimise lives in header tabs. */
  showProfileStrength?: boolean;
}

export const ContentPersonaPreferencesBody: React.FC<ContentPersonaPreferencesBodyProps> = ({
  userPreferences,
  chatHistory,
  connected,
  profileStrengthPercent,
  strengthLabel,
  strengthTooltip,
  profileStrengthLoading,
  onOptimiseProfile,
  onPreferenceChange,
  onPersonaUpdate,
  onClose,
  showProfileStrength = true,
}) => (
  <>
    {connected && showProfileStrength && (
      <div className="linkedin-writer-header-persona-strength">
        <OptimiseProfileControl
          onOptimiseProfile={onOptimiseProfile}
          profileStrengthPercent={profileStrengthPercent}
          strengthLabel={strengthLabel}
          strengthTooltip={strengthTooltip}
          isLoading={profileStrengthLoading}
          isDisabled={false}
          variant="ticker"
        />
      </div>
    )}
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
      <strong>Current Settings:</strong> {userPreferences.tone} tone • {userPreferences.industry || 'Not set'} industry •{' '}
      {chatHistory.length} messages
    </div>
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        background: '#f8f9fa',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <h5 style={{ margin: 0, color: '#2d3748', fontSize: '14px', fontWeight: '600' }}>Writing Persona</h5>
        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
          Persona is applied when available. Click the persona chip below to edit your writing style.
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          background: 'white',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
        }}
      >
        <PersonaChip platform="linkedin" onPersonaUpdate={onPersonaUpdate} />
      </div>
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
        Click persona to edit writing style, tone, and preferences
      </div>
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Tone</div>
        <select
          value={userPreferences.tone}
          onChange={(e) => onPreferenceChange('tone', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#f8f9fa',
            fontSize: '12px',
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
          onChange={(e) => onPreferenceChange('industry', e.target.value)}
          placeholder="e.g., Technology"
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#f8f9fa',
            fontSize: '12px',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Target Audience</div>
        <input
          value={userPreferences.target_audience}
          onChange={(e) => onPreferenceChange('target_audience', e.target.value)}
          placeholder="e.g., Product Managers"
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#f8f9fa',
            fontSize: '12px',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Writing Style</div>
        <select
          value={userPreferences.writing_style}
          onChange={(e) => onPreferenceChange('writing_style', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 4,
            background: '#f8f9fa',
            fontSize: '12px',
          }}
        >
          <option>Clear and Concise</option>
          <option>Storytelling</option>
          <option>Analytical</option>
          <option>Persuasive</option>
        </select>
      </div>
    </div>
    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
        <input
          type="checkbox"
          checked={userPreferences.hashtag_preferences}
          onChange={(e) => onPreferenceChange('hashtag_preferences', e.target.checked)}
          style={{ margin: 0 }}
        />
        Include Hashtags
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
        <input
          type="checkbox"
          checked={userPreferences.cta_preferences}
          onChange={(e) => onPreferenceChange('cta_preferences', e.target.checked)}
          style={{ margin: 0 }}
        />
        Include Call-to-Action
      </label>
    </div>
    <div
      style={{
        borderTop: '1px solid #e9ecef',
        paddingTop: '12px',
        fontSize: '11px',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 600, color: '#333' }}>Current Context:</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {userPreferences.tone && (
          <span
            style={{
              background: '#e3f2fd',
              color: '#1976d2',
              padding: '2px 6px',
              borderRadius: 8,
              fontSize: '10px',
            }}
          >
            {userPreferences.tone}
          </span>
        )}
        {userPreferences.industry && (
          <span
            style={{
              background: '#f3e5f5',
              color: '#7b1fa2',
              padding: '2px 6px',
              borderRadius: 8,
              fontSize: '10px',
            }}
          >
            {userPreferences.industry}
          </span>
        )}
        {userPreferences.target_audience && (
          <span
            style={{
              background: '#e8f5e8',
              color: '#388e3c',
              padding: '2px 6px',
              borderRadius: 8,
              fontSize: '10px',
            }}
          >
            {userPreferences.target_audience}
          </span>
        )}
        <span
          style={{
            background: '#fff3e0',
            color: '#f57c00',
            padding: '2px 6px',
            borderRadius: 8,
            fontSize: '10px',
          }}
        >
          {chatHistory.length} messages
        </span>
      </div>
    </div>
    <div style={{ borderTop: '1px solid #e9ecef', paddingTop: '12px', marginTop: '12px' }}>
      <div style={{ marginBottom: '8px', fontWeight: 600, color: '#333', fontSize: '12px' }}>Quick Actions</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('linkedinwriter:openBrainstorm'));
          }}
          style={{
            flex: 1,
            width: '100%',
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
          }}
          title="Brainstorm content ideas"
        >
          💡 Brainstorm Ideas
        </button>
      </div>
    </div>
  </>
);
