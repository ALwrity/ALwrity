import React, { useMemo } from 'react';
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
  qualityMetrics?: any;
  draft: string;
  showPreview: boolean;
  onPreviewToggle: () => void;
  assistantOn?: boolean;
  onAssistantToggle?: (enabled: boolean) => void;
  topic?: string;
  platform?: string;
}

const MainContentPreviewHeader: React.FC<MainContentPreviewHeaderProps> = ({
  researchSources,
  citations,
  searchQueries,
  qualityMetrics,
  draft,
  showPreview,
  onPreviewToggle,
  assistantOn,
  onAssistantToggle,
  topic,
  platform = 'linkedin'
}) => {
  const getChipColor = (v?: number) => {
    if (typeof v !== 'number') return '#6b7280';
    if (v >= 0.8) return '#10b981';
    if (v >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  // Memoize chips array to prevent infinite re-rendering
  const chips = useMemo(() => {
    const chipArray = qualityMetrics ? [
      { label: 'Overall', value: qualityMetrics.overall_score },
      { label: 'Accuracy', value: qualityMetrics.factual_accuracy },
      { label: 'Verification', value: qualityMetrics.source_verification },
      { label: 'Coverage', value: qualityMetrics.citation_coverage }
    ] : [];
    
    console.log('🔍 [ContentPreviewHeader] Chips array created:', {
      qualityMetrics: qualityMetrics,
      chips: chipArray,
      chipsLength: chipArray.length
    });
    
    return chipArray;
  }, [qualityMetrics]);

  // Helper to build descriptive chip tooltip text
  const chipDescriptions: Record<string, string> = {
    Overall: 'Overall blends accuracy, verification and coverage into a single reliability score for this draft.',
    Accuracy: 'Factual Accuracy estimates how likely statements are to be factually correct based on grounding signals.',
    Verification: 'Source Verification reflects how well claims are linked to credible sources and whether citations match claims.',
    Coverage: 'Citation Coverage indicates how much of the content is supported with citations. Higher is better.'
  };

  const displayPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);

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
        <span>{topic ? `${topic} - ${displayPlatform} Content Preview` : `${displayPlatform} Content Preview`}</span>
        
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
        {/* Quality Metrics Chip */}
        {chips.length > 0 && (
          <div style={{ position: 'relative' }}>
            {/* Main Quality Metrics Chip */}
            <div
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: '1px solid #047857',
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
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                transform: 'translateZ(0)',
                userSelect: 'none'
              }}
              title="Quality metrics available. Hover to see detailed progress bars and explanations."
              onMouseEnter={(e) => {
                // Clear any existing timeout
                const target = e.currentTarget as ExtendedDivElement;
                if (target._qualityTooltipTimeout) {
                  clearTimeout(target._qualityTooltipTimeout);
                  target._qualityTooltipTimeout = null;
                }
                
                // Create and show quality metrics tooltip with circular progress bars
                const tooltip = document.createElement('div');
                tooltip.style.cssText = `
                  position: fixed;
                  z-index: 100000;
                  background: white;
                  border: 1px solid #d1fae5;
                  border-radius: 16px;
                  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
                  padding: 24px;
                  max-width: 500px;
                  font-size: 12px;
                  opacity: 0;
                  transform: translateY(-8px);
                  transition: all 0.2s ease;
                  pointer-events: auto;
                `;
                
                // Create circular progress bars for each metric
                const createCircularProgress = (label: string, value: number, description: string) => {
                  const percentage = Math.round(value * 100);
                  const color = getChipColor(value);
                  const circumference = 2 * Math.PI * 45; // radius = 45
                  const strokeDasharray = circumference;
                  const strokeDashoffset = circumference - (percentage / 100) * circumference;
                  
                  return `
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${color};">
                      <div style="position: relative; width: 60px; height: 60px;">
                        <svg width="60" height="60" style="transform: rotate(-90deg);">
                          <circle cx="30" cy="30" r="45" stroke="#e5e7eb" stroke-width="6" fill="none"/>
                          <circle cx="30" cy="30" r="45" stroke="${color}" stroke-width="6" fill="none" 
                                  stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
                                  style="transition: stroke-dashoffset 0.5s ease;"/>
                        </svg>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 700; font-size: 14px; color: ${color};">
                          ${percentage}%
                        </div>
                      </div>
                      <div style="flex: 1;">
                        <div style="font-weight: 700; color: #1f2937; margin-bottom: 4px; font-size: 14px;">${label}</div>
                        <div style="color: #6b7280; line-height: 1.4; font-size: 11px;">${description}</div>
                      </div>
                    </div>
                  `;
                };
                
                let progressBarsHtml = '<div style="margin-bottom: 16px; font-weight: 700; color: #059669; font-size: 16px; text-align: center;">Quality Metrics</div>';
                
                chips.forEach(chip => {
                  progressBarsHtml += createCircularProgress(
                    chip.label, 
                    chip.value || 0, 
                    chipDescriptions[chip.label] || ''
                  );
                });
                
                tooltip.innerHTML = progressBarsHtml;
                
                // Add mouse events to tooltip to keep it visible
                tooltip.addEventListener('mouseenter', () => {
                  if (target._qualityTooltipTimeout) {
                    clearTimeout(target._qualityTooltipTimeout);
                    target._qualityTooltipTimeout = null;
                  }
                });
                
                tooltip.addEventListener('mouseleave', () => {
                  target._qualityTooltipTimeout = setTimeout(() => {
                    if (tooltip.parentNode) {
                      tooltip.style.opacity = '0';
                      tooltip.style.transform = 'translateY(-8px)';
                      setTimeout(() => {
                        if (tooltip.parentNode) {
                          tooltip.remove();
                        }
                      }, 200);
                    }
                    target._qualityTooltip = null;
                  }, 100);
                });
                
                document.body.appendChild(tooltip);
                const rect = e.currentTarget.getBoundingClientRect();
                tooltip.style.left = Math.min(rect.left, window.innerWidth - 520) + 'px';
                tooltip.style.top = (rect.bottom + 8) + 'px';
                
                // Animate in
                setTimeout(() => {
                  tooltip.style.opacity = '1';
                  tooltip.style.transform = 'translateY(0)';
                }, 10);
                
                target._qualityTooltip = tooltip;
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as ExtendedDivElement;
                if (target._qualityTooltip) {
                  // Add delay before hiding to allow moving to tooltip
                  target._qualityTooltipTimeout = setTimeout(() => {
                    const tooltip = target._qualityTooltip;
                    if (tooltip && tooltip.parentNode) {
                      tooltip.style.opacity = '0';
                      tooltip.style.transform = 'translateY(-8px)';
                      setTimeout(() => {
                        if (tooltip.parentNode) {
                          tooltip.remove();
                        }
                      }, 200);
                    }
                    target._qualityTooltip = null;
                  }, 100);
                }
              }}
              onMouseMove={(e) => {
                // Keep tooltip visible when moving to progress bars
                const target = e.currentTarget as ExtendedDivElement;
                if (target._qualityTooltip) {
                  const tooltip = target._qualityTooltip;
                  const rect = e.currentTarget.getBoundingClientRect();
                  tooltip.style.left = Math.min(rect.left, window.innerWidth - 520) + 'px';
                  tooltip.style.top = (rect.bottom + 8) + 'px';
                }
              }}
              onMouseOver={(e) => {
                // Add hover effect to the chip itself
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.4)';
              }}
              onMouseOut={(e) => {
                // Remove hover effect
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
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
              Quality Metrics
            </div>
          </div>
        )}
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
                <label 
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', cursor: 'pointer' }}
                  title="Toggle preview visibility"
                >
                  <input 
                    type="checkbox" 
                    checked={!showPreview} 
                    onChange={() => onPreviewToggle()} 
                    style={{ margin: 0 }}
                  />
                  Hide Preview
                </label>
      </div>
    </div>
  );
};

export default MainContentPreviewHeader;
