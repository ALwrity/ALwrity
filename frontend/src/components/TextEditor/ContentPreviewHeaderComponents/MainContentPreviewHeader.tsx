import React from 'react';
import { Tooltip } from '@mui/material';
import { type LinkedInPreviewMode } from '../../LinkedInWriter/components/LinkedInPreviewModeToggle';
import { TextToSpeechButton } from '../../shared/TextToSpeechButton';

interface MainContentPreviewHeaderProps {
  researchSources?: any[];
  citations?: any[];
  searchQueries?: string[];
  draft: string;
  assistantOn?: boolean;
  onAssistantToggle?: (enabled: boolean) => void;
  topic?: string;
  platform?: string;
  previewMode?: LinkedInPreviewMode;
  onPreviewModeChange?: (mode: LinkedInPreviewMode) => void;
}

const MainContentPreviewHeader: React.FC<MainContentPreviewHeaderProps> = ({
  researchSources,
  citations,
  searchQueries,
  draft,
  assistantOn,
  onAssistantToggle,
  topic,
  platform = 'linkedin',
  previewMode,
  onPreviewModeChange,
}) => {

  return (
    <div style={{
      padding: '12px 16px',
      background: '#e1f5fe',
      borderBottom: '1px solid #b3e5fc',
      fontSize: '12px',
      fontWeight: '600',
      color: '#0277bd',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {topic && (
          <Tooltip
            title={<span style={{ fontSize: 12, lineHeight: 1.6 }}>{topic}</span>}
            arrow placement="bottom-start"
            componentsProps={{ tooltip: { sx: { maxWidth: 420, bgcolor: '#1e293b', color: '#f1f5f9', fontSize: 12, lineHeight: 1.6, p: 1.5, borderRadius: 2 } } }}
          >
            <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#0f172a', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, cursor: 'pointer' }}>
              {topic}
            </div>
          </Tooltip>
        )}
        
        {/* Persona Chip — moved to editor toolbar */}
        {/* Research Chip — moved to editor toolbar */}
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        
                {/* Read aloud */}
                <TextToSpeechButton text={draft} size="small" showSettings={false} />
                {/* Assistive Writing toggle */}
                {onAssistantToggle && (
                  <label 
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}
                    title="Assistive Writing: Get real-time AI-powered writing suggestions as you type. Uses Exa.ai for web research and Gemini for intelligent content generation. Automatically enables editing mode to allow typing and content modification."
                  >
                    <input 
                      type="checkbox" 
                      checked={assistantOn || false} 
                      onChange={(e) => onAssistantToggle(e.target.checked)} 
                    />
                    Assistive Writing
                  </label>
                )}
                 
      </div>
    </div>
  );
};

export default MainContentPreviewHeader;
