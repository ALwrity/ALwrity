import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import PersonaEditorModal from './PersonaEditorModal';
import { getUserPersonas, getPlatformPersona, updatePersona, updatePlatformPersona } from '../../../api/persona';
import { shouldSkipOnboarding } from '../../../utils/demoMode';

interface PersonaData {
  id?: number;
  user_id?: number;
  persona_name: string;
  archetype: string;
  core_belief: string;
  brand_voice_description: string;
  linguistic_fingerprint: any;
  platform_adaptations: any;
  confidence_score: number;
  ai_analysis_version: string;
  platform_type: string;
  sentence_metrics: any;
  lexical_features: any;
  rhetorical_devices: any;
  tonal_range: any;
  stylistic_constraints: any;
  content_format_rules: any;
  engagement_patterns: any;
  posting_frequency: any;
  content_types: any;
  platform_best_practices: any;
  algorithm_considerations: any;
}

interface PersonaChipProps {
  platform: string;
  onPersonaUpdate?: (personaData: PersonaData) => void;
}

const PersonaChip: React.FC<PersonaChipProps> = ({
  platform,
  onPersonaUpdate
}) => {
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolve the active Clerk user so the persona write carries the
  // correct tenant id (the previous `user_id: 1` was a multi-tenant
  // collision across concurrent users).
  const { user } = useUser();

  // Fetch persona data
  const fetchPersonaData = async () => {
    // Skip API calls in feature-only mode (no persona data available)
    if (shouldSkipOnboarding()) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      const [coreList, platformData] = await Promise.all([
        getUserPersonas(),
        getPlatformPersona(platform)
      ]);

      if (!coreList || !platformData) {
        setPersonaData(null);
        return;
      }

      if (coreList && platformData) {
        const corePersona = platformData?.core_persona || {};
        const platformPersona = platformData?.platform_persona || {};
        const qualityMetrics = platformData?.quality_metrics || {};
        
        if (!corePersona || Object.keys(corePersona).length === 0) {
          setPersonaData(null);
          return;
        }

        setPersonaData({
          id: platformData?.id || 1,
          user_id: user?.id ? Number(user.id) : undefined,
          persona_name: corePersona.persona_name || 'Untitled Persona',
          archetype: corePersona.archetype || 'General',
          core_belief: corePersona.core_belief || '',
          brand_voice_description: corePersona.brand_voice_description || corePersona.core_belief || '',
          linguistic_fingerprint: corePersona.linguistic_fingerprint || {},
          platform_adaptations: corePersona.platform_adaptations || {},
          confidence_score: qualityMetrics.confidence_score || corePersona.confidence_score || 0,
          ai_analysis_version: platformData?.ai_analysis_version || '1.0',
          platform_type: platform,
          sentence_metrics: platformPersona?.sentence_metrics || {},
          lexical_features: platformPersona?.lexical_features || {},
          rhetorical_devices: platformPersona?.rhetorical_devices || {},
          tonal_range: platformPersona?.tonal_range || {},
          stylistic_constraints: platformPersona?.stylistic_constraints || {},
          content_format_rules: platformPersona?.content_format_rules || {},
          engagement_patterns: platformPersona?.engagement_patterns || {},
          posting_frequency: platformPersona?.posting_frequency || {},
          content_types: platformPersona?.content_types || {},
          platform_best_practices: platformPersona?.platform_best_practices || {},
          algorithm_considerations: platformPersona?.algorithm_considerations || {},
        } as any);
      }
    } catch (err) {
      setError('Failed to load persona data');
      console.error('Error fetching persona:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const handleSavePersona = async (data: PersonaData, saveToDatabase: boolean) => {
    try {
      if (saveToDatabase) {
        // Save core persona simple fields
        if (data.id) {
          const corePayload: any = {
            persona_name: data.persona_name,
            archetype: data.archetype,
            core_belief: data.core_belief,
            brand_voice_description: data.brand_voice_description,
            linguistic_fingerprint: data.linguistic_fingerprint,
            platform_adaptations: data.platform_adaptations,
          };

          // Use authenticated API client, note that user ID is extracted from JWT
          await updatePersona(1, data.id, { core_persona: corePayload });
        }

        // Save platform persona fields
        const platformPayload: any = {
          sentence_metrics: data.sentence_metrics,
          lexical_features: data.lexical_features,
          rhetorical_devices: data.rhetorical_devices,
          tonal_range: data.tonal_range,
          stylistic_constraints: data.stylistic_constraints,
          content_format_rules: data.content_format_rules,
          engagement_patterns: data.engagement_patterns,
          posting_frequency: data.posting_frequency,
          content_types: data.content_types,
          platform_best_practices: data.platform_best_practices,
          algorithm_considerations: data.algorithm_considerations,
        };

        // Use authenticated API client, note that user ID is extracted from JWT
        await updatePlatformPersona(platform, platformPayload);
      }

      // Update local state
      setPersonaData(data);
      
      // Notify parent component
      if (onPersonaUpdate) {
        onPersonaUpdate(data);
      }

      console.log('Persona updated:', saveToDatabase ? 'saved to database' : 'session only');
    } catch (err) {
      console.error('Error saving persona:', err);
      setError('Failed to save persona changes');
    }
  };

  const getPersonaColor = (confidence?: number) => {
    if (!confidence) return '#6b7280';
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const getPersonaIcon = (archetype?: string) => {
    if (!archetype) return '👤';
    
    const archetypeIcons: Record<string, string> = {
      'pragmatic futurist': '🔮',
      'thoughtful educator': '📚',
      'innovative leader': '🚀',
      'analytical expert': '🔍',
      'creative storyteller': '✨',
      'strategic advisor': '🎯',
      'authentic connector': '🤝',
      'data-driven optimist': '📊'
    };

    const lowerArchetype = archetype.toLowerCase();
    for (const [key, icon] of Object.entries(archetypeIcons)) {
      if (lowerArchetype.includes(key)) {
        return icon;
      }
    }
    
    return '👤';
  };

  if (isLoading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
        border: '1px solid #d1d5db',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#9ca3af',
          animation: 'pulse 2s infinite'
        }} />
        Loading Persona...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        border: '1px solid #fca5a5',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#dc2626',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer'
      }}
      onClick={() => fetchPersonaData()}
      title="Click to retry loading persona data"
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#ef4444'
        }} />
        No Persona
      </div>
    );
  }

  if (!personaData) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
        border: '1px solid #9ca3af',
        borderRadius: '999px',
        padding: '6px 14px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer'
      }}
      onClick={() => fetchPersonaData()}
      title="No persona configured yet. Click to retry."
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#9ca3af'
        }} />
        No Persona
      </div>
    );
  }

  const confidence = personaData.confidence_score || 0;
  const confidenceColor = getPersonaColor(confidence);
  
  // Debug: Log the confidence score to see what's being stored
  console.log('PersonaChip confidence_score:', personaData.confidence_score, 'processed:', confidence);
  const personaIcon = getPersonaIcon(personaData.archetype);

  return (
    <>
      <div
        style={{
          background: `linear-gradient(135deg, ${confidenceColor} 0%, ${confidenceColor}dd 100%)`,
          border: `1px solid ${confidenceColor}`,
          borderRadius: '999px',
          padding: '6px 14px',
          fontSize: '11px',
          fontWeight: '700',
          color: 'white',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: `0 2px 8px ${confidenceColor}40`,
          transform: 'translateZ(0)',
          userSelect: 'none'
        }}
        title={`${personaData.persona_name} - ${personaData.archetype || 'No archetype'} (${Math.round(confidence * 100)}% confidence). Click to edit.`}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
          e.currentTarget.style.boxShadow = `0 4px 16px ${confidenceColor}60`;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `0 2px 8px ${confidenceColor}40`;
        }}
        onClick={() => setShowEditor(true)}
      >
        <div style={{
          fontSize: '12px',
          flexShrink: 0
        }}>
          {personaIcon}
        </div>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.9)',
          flexShrink: 0,
          boxShadow: '0 0 6px rgba(255, 255, 255, 0.5)'
        }} />
        <span style={{ whiteSpace: 'nowrap' }}>
          {personaData.persona_name || 'Untitled Brand Voice'}
        </span>
        <div style={{
          fontSize: '10px',
          opacity: 0.8,
          marginLeft: '4px'
        }}>
          {Math.round(confidence * 100)}%
        </div>
      </div>

      <PersonaEditorModal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        personaData={personaData}
        onSave={(data, saveToDatabase) => handleSavePersona(data, saveToDatabase)}
        platform={platform}
      />
    </>
  );
};

export default PersonaChip;
