import React from 'react';
import { Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { type LinkedInPreviewMode } from '../../LinkedInWriter/components/LinkedInPreviewModeToggle';
import PersonaChip from './PersonaChip';
import { TextToSpeechButton } from '../../shared/TextToSpeechButton';

// Extend HTMLDivElement interface for custom tooltip properties
interface ExtendedDivElement extends HTMLDivElement {
  _researchTooltip?: HTMLDivElement | null;
  _citationsTooltip?: HTMLDivElement | null;
  _searchQueriesTooltip?: HTMLDivElement | null;
  _qualityTooltip?: HTMLDivElement | null;
  _researchTooltipTimeout?: NodeJS.Timeout | null;
  _qualityTooltipTimeout?: NodeJS.Timeout | null;
}

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
        
        {/* Persona Chip */}
        <PersonaChip 
          platform={platform} 
          onPersonaUpdate={(personaData) => {
            console.log('Persona updated:', personaData);
            // You can add additional logic here to handle persona updates
          }}
        />
        
        {/* Research Chip with Hover Sub-chips */}
        {((researchSources && researchSources.length > 0) || (citations && citations.length > 0) || (searchQueries && searchQueries.length > 0)) && (
          <div style={{ position: 'relative' }}>
            {/* Main Research Chip */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                border: '1px solid #0284c7',
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
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
                transform: 'translateZ(0)',
                userSelect: 'none'
              }}
              title="Research data available. Hover to see sources, citations, and queries."
              onMouseEnter={(e) => {
                // Clear any existing timeout
                const target = e.currentTarget as ExtendedDivElement;
                if (target._researchTooltipTimeout) {
                  clearTimeout(target._researchTooltipTimeout);
                  target._researchTooltipTimeout = null;
                }
                
                // Create and show research sub-chips tooltip
                const tooltip = document.createElement('div');
                tooltip.style.cssText = `
                  position: fixed;
                  z-index: 100000;
                  background: white;
                  border: 1px solid #cfe9f7;
                  border-radius: 12px;
                  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                  padding: 16px;
                  max-width: 400px;
                  font-size: 12px;
                  opacity: 0;
                  transform: translateY(-8px);
                  transition: all 0.2s ease;
                  pointer-events: auto;
                `;
                
                let subChipsHtml = '<div style="margin-bottom: 12px; font-weight: 600; color: #0a66c2; font-size: 14px;">Research Data</div>';
                
                // Add Sources sub-chip
                if (researchSources && researchSources.length > 0) {
                  subChipsHtml += `
                    <div style="display: inline-block; margin: 3px; padding: 6px 12px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 16px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;" 
                         onmouseenter="this.style.background='#e0f2fe'; this.style.transform='scale(1.05)'" 
                         onmouseleave="this.style.background='#f0f9ff'; this.style.transform='scale(1)'"
                         onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showResearchSourcesModal', { detail: 'sources' }))">
                      <span style="display: inline-block; width: 6px; height: 6px; background: #10b981; border-radius: 50%; margin-right: 6px; box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);"></span>
                      Sources: ${researchSources.length}
                    </div>
                  `;
                }
                
                // Add Citations sub-chip
                if (citations && citations.length > 0) {
                  subChipsHtml += `
                    <div style="display: inline-block; margin: 3px; padding: 6px 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 16px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;"
                         onmouseenter="this.style.background='#fde68a'; this.style.transform='scale(1.05)'" 
                         onmouseleave="this.style.background='#fef3c7'; this.style.transform='scale(1)'"
                         onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showCitationsModal', { detail: 'citations' }))">
                      <span style="display: inline-block; width: 6px; height: 6px; background: #f59e0b; border-radius: 50%; margin-right: 6px; box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);"></span>
                      Citations: ${citations.length}
                    </div>
                  `;
                }
                
                // Add Queries sub-chip
                if (searchQueries && searchQueries.length > 0) {
                  subChipsHtml += `
                    <div style="display: inline-block; margin: 3px; padding: 6px 12px; background: #f3e8ff; border: 1px solid #8b5cf6; border-radius: 16px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;"
                         onmouseenter="this.style.background='#e9d5ff'; this.style.transform='scale(1.05)'" 
                         onmouseleave="this.style.background='#f3e8ff'; this.style.transform='scale(1)'"
                         onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showSearchQueriesModal', { detail: 'queries' }))">
                      <span style="display: inline-block; width: 6px; height: 6px; background: #8b5cf6; border-radius: 50%; margin-right: 6px; box-shadow: 0 0 4px rgba(139, 92, 246, 0.5);"></span>
                      Queries: ${searchQueries.length}
                    </div>
                  `;
                }
                
                tooltip.innerHTML = subChipsHtml;
                
                // Add mouse events to tooltip to keep it visible
                tooltip.addEventListener('mouseenter', () => {
                  if (target._researchTooltipTimeout) {
                    clearTimeout(target._researchTooltipTimeout);
                    target._researchTooltipTimeout = null;
                  }
                });
                
                tooltip.addEventListener('mouseleave', () => {
                  target._researchTooltipTimeout = setTimeout(() => {
                    if (tooltip.parentNode) {
                      tooltip.style.opacity = '0';
                      tooltip.style.transform = 'translateY(-8px)';
                      setTimeout(() => {
                        if (tooltip.parentNode) {
                          tooltip.remove();
                        }
                      }, 200);
                    }
                    target._researchTooltip = null;
                  }, 100);
                });
                
                document.body.appendChild(tooltip);
                const rect = e.currentTarget.getBoundingClientRect();
                tooltip.style.left = Math.min(rect.left, window.innerWidth - 420) + 'px';
                tooltip.style.top = (rect.bottom + 8) + 'px';
                
                // Animate in
                setTimeout(() => {
                  tooltip.style.opacity = '1';
                  tooltip.style.transform = 'translateY(0)';
                }, 10);
                
                target._researchTooltip = tooltip;
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as ExtendedDivElement;
                if (target._researchTooltip) {
                  // Add delay before hiding to allow moving to tooltip
                  target._researchTooltipTimeout = setTimeout(() => {
                    const tooltip = target._researchTooltip;
                    if (tooltip && tooltip.parentNode) {
                      tooltip.style.opacity = '0';
                      tooltip.style.transform = 'translateY(-8px)';
                      setTimeout(() => {
                        if (tooltip.parentNode) {
                          tooltip.remove();
                        }
                      }, 200);
                    }
                    target._researchTooltip = null;
                  }, 100);
                }
              }}
              onMouseMove={(e) => {
                // Keep tooltip visible when moving to sub-chips
                const target = e.currentTarget as ExtendedDivElement;
                if (target._researchTooltip) {
                  const tooltip = target._researchTooltip;
                  const rect = e.currentTarget.getBoundingClientRect();
                  tooltip.style.left = Math.min(rect.left, window.innerWidth - 420) + 'px';
                  tooltip.style.top = (rect.bottom + 8) + 'px';
                }
              }}
              onMouseOver={(e) => {
                // Add hover effect to the chip itself
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(14, 165, 233, 0.4)';
              }}
              onMouseOut={(e) => {
                // Remove hover effect
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.3)';
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.9)',
                flexShrink: 0,
                boxShadow: '0 0 6px rgba(255, 255, 255, 0.5)'
              }} />
              Research
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  {draft.split(/\s+/).length} words • {Math.ceil(draft.split(/\s+/).length / 200)} min read
                </span>
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
{previewMode && onPreviewModeChange && (
  <ToggleButtonGroup size="small" exclusive value={previewMode} onChange={(_, next) => { if (next) onPreviewModeChange(next); }} aria-label="Preview mode">
    <ToggleButton value="linkedin" sx={{ textTransform: 'none', px: 1, py: 0.25, fontSize: 10 }}>LinkedIn</ToggleButton>
    <ToggleButton value="studio" sx={{ textTransform: 'none', px: 1, py: 0.25, fontSize: 10 }}>Studio</ToggleButton>
  </ToggleButtonGroup>
)}
                
      </div>
    </div>
  );
};

export default MainContentPreviewHeader;
