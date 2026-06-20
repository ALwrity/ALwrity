import React, { useState, useRef, useEffect } from 'react';
import { hallucinationDetectorService, HallucinationDetectionResponse } from '../../services/hallucinationDetectorService';
import FactCheckResults from '../LinkedInWriter/components/FactCheckResults';

interface TextSelectionHandlerOptions {
  onGenerateImage?: (text: string) => void;
  isGeneratingImage?: boolean;
  onGenerateVideo?: (text: string) => void;
  isGeneratingVideo?: boolean;
}

const useTextSelectionHandler = (
  contentRef: React.RefObject<HTMLDivElement>,
  options?: TextSelectionHandlerOptions
) => {
  const {
    onGenerateImage,
    isGeneratingImage = false,
    onGenerateVideo,
    isGeneratingVideo = false,
  } = options || {};
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [factCheckResults, setFactCheckResults] = useState<HallucinationDetectionResponse | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckProgress, setFactCheckProgress] = useState<{ step: string; progress: number } | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fact-checking functionality
  const handleCheckFacts = async (text: string) => {
    console.log('🔍 [TextSelectionHandler] handleCheckFacts called with text:', text);
    if (!text.trim()) {
      console.log('🔍 [TextSelectionHandler] No text to check, returning');
      return;
    }
    
    console.log('🔍 [TextSelectionHandler] Starting fact check for:', text.trim());
    setIsFactChecking(true);
    setSelectionMenu(null);
    
    // Progress tracking
    const progressSteps = [
      { step: "Extracting verifiable claims...", progress: 20 },
      { step: "Searching for evidence...", progress: 40 },
      { step: "Analyzing claims against sources...", progress: 70 },
      { step: "Generating final assessment...", progress: 90 },
      { step: "Completing fact-check...", progress: 100 }
    ];
    
    let currentStepIndex = 0;
    
    // Start progress updates
    const progressInterval = setInterval(() => {
      if (currentStepIndex < progressSteps.length) {
        setFactCheckProgress(progressSteps[currentStepIndex]);
        currentStepIndex++;
      }
    }, 2000); // Update every 2 seconds
    
    // Set a timeout for the fact check (30 seconds)
    const timeoutId = setTimeout(() => {
      console.log('🔍 [TextSelectionHandler] Fact check timeout reached');
      clearInterval(progressInterval);
      setFactCheckProgress(null);
      setIsFactChecking(false);
      setFactCheckResults({
        success: false,
        claims: [],
        overall_confidence: 0,
        total_claims: 0,
        supported_claims: 0,
        refuted_claims: 0,
        insufficient_claims: 0,
        timestamp: new Date().toISOString(),
        error: 'Fact check timed out after 30 seconds. Please try again with shorter text.'
      });
    }, 30000); // 30 second timeout
    
    try {
      console.log('🔍 [TextSelectionHandler] Calling hallucinationDetectorService.detectHallucinations...');
      const results = await hallucinationDetectorService.detectHallucinations({
        text: text.trim(),
        include_sources: true,
        max_claims: 10
      });
      
      console.log('🔍 [TextSelectionHandler] Fact check results received:', results);
      console.log('🔍 [TextSelectionHandler] Results success:', results.success);
      console.log('🔍 [TextSelectionHandler] Results claims count:', results.claims?.length || 0);
      console.log('🔍 [TextSelectionHandler] Setting factCheckResults state...');
      setFactCheckResults(results);
      console.log('🔍 [TextSelectionHandler] factCheckResults state set');
    } catch (error) {
      console.error('🔍 [TextSelectionHandler] Error checking facts:', error);
      setFactCheckResults({
        success: false,
        claims: [],
        overall_confidence: 0,
        total_claims: 0,
        supported_claims: 0,
        refuted_claims: 0,
        insufficient_claims: 0,
        timestamp: new Date().toISOString(),
        error: `Failed to check facts: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      console.log('🔍 [TextSelectionHandler] Fact check completed, setting isFactChecking to false');
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      setFactCheckProgress(null);
      setIsFactChecking(false);
    }
  };

  const handleCloseFactCheckResults = () => {
    setFactCheckResults(null);
  };

  // Quick edit functionality for selected text
  const handleQuickEdit = (editType: string, selectedText: string) => {
    console.log('🔍 [TextSelectionHandler] handleQuickEdit called:', editType, selectedText);
    
    let editedText = selectedText;
    
    switch (editType) {
      case 'tighten':
        // Add hook emoji to the beginning
        editedText = selectedText.replace(/^(.*?)([.!?])?$/, '👉 $1$2');
        break;
      case 'add-cta':
        // Add call-to-action
        editedText = selectedText + '\n\nWhat are your thoughts on this? Share your experience in the comments below!';
        break;
      case 'shorten':
        // Truncate if longer than 100 characters
        editedText = selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText;
        break;
      case 'lengthen':
        // Add more content
        editedText = selectedText + '\n\nThis approach has shown strong results. The key is to maintain consistency while adapting to changing conditions.';
        break;
      case 'professionalize':
        // Add professional prefix
        editedText = '[Professionalized]\n\n' + selectedText;
        break;
      default:
        return;
    }
    
    // Dispatch event to replace the selected text
    window.dispatchEvent(new CustomEvent('linkedinwriter:replaceSelectedText', { 
      detail: { 
        originalText: selectedText,
        editedText: editedText,
        editType: editType
      } 
    }));
    
    // Close the selection menu
    setSelectionMenu(null);
  };

  // Cleanup progress and timeouts on unmount
  useEffect(() => {
    return () => {
      setFactCheckProgress(null);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  // Debug: Log selection menu changes
  useEffect(() => {
    console.log('🔍 [TextSelectionHandler] Selection menu state changed:', selectionMenu);
  }, [selectionMenu]);

  // Text selection handler with debouncing
  const handleTextSelection = () => {
    console.log('🔍 [TextSelectionHandler] handleTextSelection called');
    
    // Clear any existing timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Debounce the selection handling
    selectionTimeoutRef.current = setTimeout(() => {
      try {
        const sel = window.getSelection();
        console.log('🔍 [TextSelectionHandler] Selection object (debounced):', sel);
        
        if (!sel || sel.rangeCount === 0) { 
          console.log('🔍 [TextSelectionHandler] No selection or range count is 0');
          setSelectionMenu(null); 
          return; 
        }
        
        const text = (sel.toString() || '').trim();
        console.log('🔍 [TextSelectionHandler] Selected text (debounced):', text, 'Length:', text.length);
        
        if (!text || text.length < 10) { 
          console.log('🔍 [TextSelectionHandler] Text too short or empty, hiding menu');
          setSelectionMenu(null); 
          return; 
        }
        
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const container = contentRef.current?.getBoundingClientRect();
        
        console.log('🔍 [TextSelectionHandler] Range rect:', rect, 'Container rect:', container);
        if (!container) { 
          console.log('🔍 [TextSelectionHandler] No container rect, hiding menu');
          setSelectionMenu(null); 
          return; 
        }
        
        const x = Math.max(8, rect.left - container.left + (rect.width / 2));
        const y = Math.max(8, rect.top - container.top);
        
        const menuPosition = { x, y, text };
        console.log('🔍 [TextSelectionHandler] Setting selection menu at position (debounced):', menuPosition);
        setSelectionMenu(menuPosition);
        
      } catch (error) {
        console.error('🔍 [TextSelectionHandler] Error handling text selection:', error);
        setSelectionMenu(null);
      }
    }, 150); // 150ms debounce
  };

  return {
    selectionMenu,
    setSelectionMenu,
    factCheckResults,
    isFactChecking,
    factCheckProgress,
    handleTextSelection,
    handleCheckFacts,
    handleCloseFactCheckResults,
    // Render the selection menu and fact-check components
    renderSelectionMenu: () => (
      <>
        {/* Text Selection Menu */}
        {selectionMenu && (
          <div
            onClick={(e) => {
              console.log('🔍 [TextSelectionHandler] Selection menu clicked!', e.target);
              e.stopPropagation();
            }}
            style={{
              position: 'absolute',
              top: selectionMenu.y - 40,
              left: selectionMenu.x - 200,
              background: 'rgba(10, 102, 194, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px 12px',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(10px)',
              zIndex: 10000,
              minWidth: '200px'
            }}
          >
            {/* Fact Check Button */}
            <button
              onClick={(e) => {
                console.log('🔍 [TextSelectionHandler] Check Facts button clicked!', selectionMenu.text);
                e.preventDefault();
                e.stopPropagation();
                handleCheckFacts(selectionMenu.text);
              }}
              disabled={isFactChecking}
              style={{
                background: isFactChecking ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isFactChecking ? 'not-allowed' : 'pointer',
                opacity: isFactChecking ? 0.6 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                width: '100%',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!isFactChecking) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFactChecking) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }
              }}
            >
              {isFactChecking ? (
                <>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Checking...
                </>
              ) : (
                <>
                  🔍 Check Facts
                </>
              )}
            </button>

            {/* Generate Image Button */}
            {onGenerateImage && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const text = selectionMenu.text;
                  setSelectionMenu(null);
                  onGenerateImage(text);
                }}
                disabled={isGeneratingImage || isGeneratingVideo}
                style={{
                  background: isGeneratingImage ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: isGeneratingImage ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingImage ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  width: '100%',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (!isGeneratingImage) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isGeneratingImage) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
              >
                {isGeneratingImage ? (
                  <>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Generating...
                  </>
                ) : (
                  <>🖼️ Generate Image</>
                )}
              </button>
            )}

            {/* Generate Video Button */}
            {onGenerateVideo && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const text = selectionMenu.text;
                  setSelectionMenu(null);
                  onGenerateVideo(text);
                }}
                disabled={isGeneratingVideo || isGeneratingImage}
                style={{
                  background: isGeneratingVideo ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: isGeneratingVideo ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingVideo ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  width: '100%',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (!isGeneratingVideo) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isGeneratingVideo) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  }
                }}
              >
                {isGeneratingVideo ? (
                  <>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Generating...
                  </>
                ) : (
                  <>🎬 Generate Video</>
                )}
              </button>
            )}

            {/* Quick Edit Options */}
            <div style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              paddingTop: '8px',
              marginTop: '4px'
            }}>
              <div style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '10px',
                fontWeight: '500',
                marginBottom: '6px',
                textAlign: 'center'
              }}>
                Quick Edit:
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px'
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('tighten', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  Tighten
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('add-cta', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  Add CTA
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('shorten', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  Shorten
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('lengthen', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  Lengthen
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('professionalize', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    gridColumn: '1 / -1'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  Professionalize
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectionMenu(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                marginTop: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
            >
              ✕ Close
            </button>
          </div>
        )}

        {/* Fact Check Progress Modal */}
        {isFactChecking && factCheckProgress && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  border: '4px solid #e3f2fd',
                  borderTop: '4px solid #1976d2',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 24px'
                }}
              />
              <h3 style={{ margin: '0 0 16px', color: '#1976d2', fontSize: '18px', fontWeight: '600' }}>
                Fact-Checking in Progress
              </h3>
              <p style={{ margin: '0 0 24px', color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                {factCheckProgress.step}
              </p>
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    width: `${factCheckProgress.progress}%`,
                    height: '100%',
                    backgroundColor: '#1976d2',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease-in-out'
                  }}
                />
              </div>
              <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>
                This may take 10-15 seconds...
              </p>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Fact Check Results Modal */}
        {factCheckResults && (
          <>
            {console.log('🔍 [TextSelectionHandler] Rendering FactCheckResults with:', factCheckResults)}
            <FactCheckResults
              results={factCheckResults}
              onClose={handleCloseFactCheckResults}
            />
          </>
        )}
      </>
    )
  };
};

export default useTextSelectionHandler;
