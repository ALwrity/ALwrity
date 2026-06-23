import React, { useEffect, useState, useRef } from 'react';
import { writingAssistantService, type WASuggestion } from '../../../services/writingAssistantService';
import {
  CitationHoverHandler,
  useTextSelectionHandler,
  DiffPreviewModal,
  ContentPreviewHeaderWithModals,
  ContentDisplayArea
} from '../../TextEditor';
import { readPrefs } from '../utils/linkedInWriterUtils';
import { useLinkedInSelectionImage } from '../hooks/useLinkedInSelectionImage';
import { useLinkedInSelectionVideo } from '../hooks/useLinkedInSelectionVideo';
import { LinkedInSelectionImageModal } from './LinkedInSelectionImageModal';
import { LinkedInSelectionVideoModal } from './LinkedInSelectionVideoModal';

interface ContentEditorProps {
  isPreviewing: boolean;
  pendingEdit: { src: string; target: string } | null;
  livePreviewHtml: string;
  draft: string;
  showPreview: boolean;
  isGenerating: boolean;
  loadingMessage: string;
  // Grounding data props
  researchSources?: any[];
  citations?: any[];
  qualityMetrics?: any;
  groundingEnabled?: boolean;
  searchQueries?: string[];
  onConfirmChanges: () => void;
  onDiscardChanges: () => void;
  onDraftChange: (value: string) => void;
  onPreviewToggle: () => void;
  topic?: string;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  isPreviewing,
  pendingEdit,
  livePreviewHtml,
  draft,
  showPreview,
  isGenerating,
  loadingMessage,
  // Grounding data props
  researchSources,
  citations,
  qualityMetrics,
  groundingEnabled,
  searchQueries,
  onConfirmChanges,
  onDiscardChanges,
  onDraftChange,
  onPreviewToggle,
  topic
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [assistantOn, setAssistantOn] = useState(false);
  const [waSuggestion, setWaSuggestion] = useState<WASuggestion | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  // Optional debug flag: set to true to enable verbose logs locally
  const DEBUG_WA = false;
  const ctaCooldownRef = useRef<number | null>(null); // 15s cooldown after dismissing CTA
  useEffect(() => {
    if (DEBUG_WA) console.log('🎯 [ContentEditor] waSuggestion changed:', waSuggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waSuggestion]);
  const waTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredOnceRef = useRef<boolean>(false);
  const ctaDebounceRef = useRef<NodeJS.Timeout | null>(null); // Debounce CTA appearance

  const prefs = readPrefs();
  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
  });

  const selectionVideo = useLinkedInSelectionVideo({
    topic,
    industry: prefs.industry,
  });

  // Initialize text selection handler
  const textSelectionHandler = useTextSelectionHandler(contentRef, {
    onGenerateImage: selectionImage.openForSelection,
    isGeneratingImage: selectionImage.isGenerating,
    onGenerateVideo: selectionVideo.openForSelection,
    isGeneratingVideo: selectionVideo.isGenerating,
  });

  // Handle selected text replacement for quick edits
  useEffect(() => {
    const handleReplaceSelectedText = (event: CustomEvent) => {
      const { originalText, editedText, editType } = event.detail;
      console.log('🔍 [ContentEditor] Replacing selected text:', { originalText, editedText, editType });
      
      // Check if we're in textarea mode (assistive writing on) or div mode
      const textarea = contentRef.current?.querySelector('textarea');
      
      if (textarea) {
        // We're in textarea mode - use textarea selection
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        console.log('🔍 [ContentEditor] Textarea mode - selection:', { start, end, selectedText });
        
        if (selectedText.trim() === originalText.trim()) {
          // Replace the selected text in the textarea
          const newValue = textarea.value.substring(0, start) + editedText + textarea.value.substring(end);
          onDraftChange(newValue);
          
          // Set cursor position after the inserted text
          setTimeout(() => {
            const newCursorPos = start + editedText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
          }, 0);
        } else {
          console.log('🔍 [ContentEditor] Textarea selection mismatch, using fallback');
          // Fallback to simple string replacement
          const newDraft = draft.replace(originalText, editedText);
          onDraftChange(newDraft);
        }
      } else {
        // We're in div mode - use DOM selection
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          console.log('🔍 [ContentEditor] No selection found, falling back to string replace');
          // Fallback to simple string replacement
          const newDraft = draft.replace(originalText, editedText);
          onDraftChange(newDraft);
          return;
        }
        
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        console.log('🔍 [ContentEditor] Div mode - selection:', { selectedText });
        
        // Verify the selected text matches what we expect
        if (selectedText.trim() === originalText.trim()) {
          // Replace the selected text directly in the DOM
          range.deleteContents();
          range.insertNode(document.createTextNode(editedText));
          
          // Clear the selection
          selection.removeAllRanges();
          
          // Get the updated content from the contentRef
          if (contentRef.current) {
            const updatedText = contentRef.current.textContent || '';
            onDraftChange(updatedText);
          }
        } else {
          console.log('🔍 [ContentEditor] Div selection mismatch, using fallback:', {
            selected: selectedText.trim(),
            expected: originalText.trim()
          });
          // Fallback to simple string replacement
          const newDraft = draft.replace(originalText, editedText);
          onDraftChange(newDraft);
        }
      }
      
      console.log(`✅ [ContentEditor] Quick edit "${editType}" applied successfully`);
    };

    window.addEventListener('linkedinwriter:replaceSelectedText', handleReplaceSelectedText as EventListener);

    return () => {
      window.removeEventListener('linkedinwriter:replaceSelectedText', handleReplaceSelectedText as EventListener);
    };
  }, [draft, onDraftChange, contentRef]);

  // --- Smart Writing Assistant (Exa) ---
  // Create a stable context hash from the last full words (excluding the in-progress word)
  const getStableContextHash = (text: string): string => {
    const tail = text.length > 300 ? text.slice(-300) : text;
    const tokens = tail.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      tokens.pop(); // drop current in-progress token so hash doesn't change each keystroke
    }
    return tokens.slice(-20).join(' '); // last 20 words represent context
  };

  const getTailForSuggestion = (text: string): string => {
    if (!text) return '';
    
    // For assistive writing, we want the last 200-300 characters to get enough context
    // This ensures we have enough words for meaningful suggestions
    const tail = text.length > 300 ? text.slice(-300).trim() : text.trim();
    
    if (DEBUG_WA) console.log('✍️ [ContentEditor] Using tail for suggestion:', {
      originalLength: text.length,
      tailLength: tail.length,
      tail: tail.substring(0, 100) + (tail.length > 100 ? '...' : '')
    });
    
    return tail;
  };

  // Function to insert text at caret position with live diff preview
  const handleInsertAtCaret = (text: string, caretIndex: number) => {
    const beforeCaret = draft.slice(0, caretIndex);
    const afterCaret = draft.slice(caretIndex);
    const newDraft = beforeCaret + text + afterCaret;
    
    // Trigger live diff preview by dispatching edit event
    window.dispatchEvent(new CustomEvent('linkedinwriter:applyEdit', {
      detail: {
        src: draft,
        target: newDraft
      }
    }));
  };

  // Function to trigger suggestions based on current text and caret position
  // Suggestion gating: 5 words + 500ms first time; then wait 3 more words OR 2s pause before next
  const lastSuggestMetaRef = useRef<{ words: number; time: number; textHash: string } | null>(null);
  const coolDownUntilRef = useRef<number | null>(null); // cooldown after 429s

  const triggerSuggestion = (currentText: string, caretIndex?: number) => {
    if (waTimerRef.current) {
      clearTimeout(waTimerRef.current);
    }

    if (assistantOn && currentText) {
      // Respect cooldown window (silence frequent logs)
      if (coolDownUntilRef.current && Date.now() < coolDownUntilRef.current) {
                return;
              }
      // Use text up to caret (what the user is actively typing), fallback to full text
      const uptoCaret = typeof caretIndex === 'number' && caretIndex >= 0
        ? currentText.slice(0, caretIndex)
        : currentText;

      const tail = getTailForSuggestion(uptoCaret);
      const words = tail.split(/\s+/).filter(word => word.length > 0);

      if (DEBUG_WA) console.log('✍️ [ContentEditor] Checking suggestion trigger:', { 
        tail: tail.substring(0, 100) + (tail.length > 100 ? '...' : ''), 
        wordCount: words.length, 
        assistantOn,
        currentTextLength: uptoCaret.length,
        lastWords: words.slice(-5).join(' ')
      });

      const textHash = getStableContextHash(uptoCaret);

      // After first auto-trigger, stop auto-calling API. Show CTA instead.
      if (hasTriggeredOnceRef.current) {
        // Check if CTA is in cooldown period
        if (ctaCooldownRef.current && Date.now() < ctaCooldownRef.current) {
          return; // Don't show CTA during cooldown
        }
        
        // Clear any existing CTA while user is typing
        setShowContinuePrompt(false);
        
        // Debounce CTA appearance to avoid showing on every keystroke
        if (ctaDebounceRef.current) {
          clearTimeout(ctaDebounceRef.current);
        }
        ctaDebounceRef.current = setTimeout(() => {
          setShowContinuePrompt(true);
          setWaSuggestion(null);
        }, 1000); // Show CTA after 1s of no typing
        return;
      }

      // First automatic suggestion only: require 5+ words and 5s delay
      if (words.length >= 5) {
        waTimerRef.current = setTimeout(async () => {
          if (DEBUG_WA) console.log('✍️ [ContentEditor] Triggering FIRST suggestion for:', tail);
          lastSuggestMetaRef.current = { words: words.length, time: Date.now(), textHash };
          try {
            const suggestions = await writingAssistantService.suggest(tail);
            if (DEBUG_WA) console.log('✍️ [ContentEditor] Got suggestions:', suggestions);
            setWaSuggestion(suggestions.length > 0 ? suggestions[0] : null);
            setWaError(null);
            hasTriggeredOnceRef.current = true;
            setShowContinuePrompt(false);
          } catch (error: any) {
            console.error('✍️ [ContentEditor] Error getting suggestion:', error);
            const msg: string = (error && error.message) ? String(error.message) : String(error);
            let userError = "Failed to get writing suggestion";
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
              userError = "API quota exceeded. Please try again later or upgrade your plan.";
              const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
              const retryMs = match ? parseInt(match[1], 10) * 1000 : 40000;
              coolDownUntilRef.current = Date.now() + retryMs;
              console.warn('✍️ [ContentEditor] Entering suggestion cooldown for ms:', retryMs);
            } else if (msg.includes('EXA_API_KEY not configured')) {
              userError = "Search service not configured";
            } else if (msg.includes('Gemini client not available')) {
              userError = "AI service not available";
            } else if (msg.includes('No relevant sources found')) {
              userError = "No relevant sources found for this context";
            }
            setWaError(userError);
            setWaSuggestion(null);
            hasTriggeredOnceRef.current = true;
            setShowContinuePrompt(true);
          }
        }, 5000);
      } else {
        if (DEBUG_WA) console.log('✍️ [ContentEditor] Not triggering suggestion: not enough words');
        setWaSuggestion(null);
      }
    } else {
      setWaSuggestion(null);
    }
  };

  // Manual continue: user explicitly asks for more suggestions
  const handleManualContinue = async (currentText: string, caretIndex?: number) => {
    const uptoCaret = typeof caretIndex === 'number' && caretIndex >= 0
      ? currentText.slice(0, caretIndex)
      : currentText;
    const tail = getTailForSuggestion(uptoCaret);
    try {
      setShowContinuePrompt(false);
      const suggestions = await writingAssistantService.suggest(tail);
      setWaSuggestion(suggestions.length > 0 ? suggestions[0] : null);
      setWaError(null);
      // Reset CTA cooldown since user actively requested suggestion
      ctaCooldownRef.current = null;
    } catch (error: any) {
      console.error('✍️ [ContentEditor] Manual continue error:', error);
      const msg: string = (error && error.message) ? String(error.message) : String(error);
      let userError = "Failed to get writing suggestion";
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        userError = "API quota exceeded. Please try again later or upgrade your plan.";
        const match = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
        const retryMs = match ? parseInt(match[1], 10) * 1000 : 40000;
        coolDownUntilRef.current = Date.now() + retryMs;
        console.warn('✍️ [ContentEditor] Entering suggestion cooldown for ms:', retryMs);
      } else if (msg.includes('EXA_API_KEY not configured')) {
        userError = "Search service not configured";
      } else if (msg.includes('Gemini client not available')) {
        userError = "AI service not available";
      } else if (msg.includes('No relevant sources found')) {
        userError = "No relevant sources found for this context";
      }
      setWaError(userError);
      setWaSuggestion(null);
      // Don't show CTA again immediately after error - start cooldown
      ctaCooldownRef.current = Date.now() + 15000;
    }
  };

  const dismissSuggestion = () => {
    setWaSuggestion(null);
    setWaError(null);
    setShowContinuePrompt(false);
    // Start 15s cooldown for CTA
    ctaCooldownRef.current = Date.now() + 15000;
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (waTimerRef.current) clearTimeout(waTimerRef.current);
      if (ctaDebounceRef.current) clearTimeout(ctaDebounceRef.current);
    };
  }, []);

  // Auto-show preview when draft is available
  useEffect(() => {
    if (draft && !showPreview) {
      onPreviewToggle();
    }
  }, [draft, showPreview, onPreviewToggle]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Predictive Diff Preview */}
      <DiffPreviewModal
        isPreviewing={isPreviewing}
        pendingEdit={pendingEdit}
        livePreviewHtml={livePreviewHtml}
        onConfirmChanges={onConfirmChanges}
        onDiscardChanges={onDiscardChanges}
      />

      {/* Full Width Content Preview */}
      <div style={{ flex: 1, padding: '24px', overflow: 'visible' }}>
        {/* Content Preview */}
        {showPreview && (
          <div style={{
            border: '1px solid #e1f5fe',
            borderRadius: '8px',
            background: '#f8fdff',
            overflow: 'visible'
          }}>
            {/* Content Preview Header */}
            <ContentPreviewHeaderWithModals
              researchSources={researchSources}
              citations={citations}
              searchQueries={searchQueries}
              qualityMetrics={qualityMetrics}
              draft={draft}
              showPreview={showPreview}
              onPreviewToggle={onPreviewToggle}
              assistantOn={assistantOn}
              onAssistantToggle={setAssistantOn}
              topic={topic}
            />

            {/* Content Display Area */}
            <ContentDisplayArea
              contentRef={contentRef}
              draft={draft}
              isGenerating={isGenerating}
              loadingMessage={loadingMessage}
              citations={citations}
              researchSources={researchSources}
              assistantOn={assistantOn}
              waSuggestion={waSuggestion}
              showContinuePrompt={showContinuePrompt}
              waError={waError}
              onDraftChange={onDraftChange}
              onDismissSuggestion={dismissSuggestion}
              onTextSelection={textSelectionHandler.handleTextSelection}
              renderSelectionMenu={textSelectionHandler.renderSelectionMenu}
              onTriggerSuggestion={triggerSuggestion}
              onContinueWriting={() => handleManualContinue(draft)}
              onInsertWithPreview={handleInsertAtCaret}
            />
          </div>
        )}
      </div>

      {/* Citation Hover Handler */}
      <CitationHoverHandler researchSources={researchSources || []} />

      <LinkedInSelectionImageModal
        open={selectionImage.modalOpen}
        onClose={selectionImage.closeModal}
        onGenerate={selectionImage.handleGenerate}
        initialPrompt={selectionImage.initialPrompt}
        isGenerating={selectionImage.isGenerating}
        generatedPreview={selectionImage.generatedPreview}
        onClosePreview={selectionImage.closePreview}
      />

      <LinkedInSelectionVideoModal
        open={selectionVideo.modalOpen}
        onClose={selectionVideo.closeModal}
        onGenerate={selectionVideo.handleGenerate}
        initialPrompt={selectionVideo.initialPrompt}
        isGenerating={selectionVideo.isGenerating}
        generatedPreview={selectionVideo.generatedPreview}
        onClosePreview={selectionVideo.closePreview}
      />
    </div>
  );
};

export { ContentEditor };