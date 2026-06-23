import React, { useMemo, useEffect, useRef, useState } from 'react';
import { formatDraftContent } from '../LinkedInWriter/utils/contentFormatters';
import WritingAssistantCard from './WritingAssistantCard';
import { WASuggestion } from '../../services/writingAssistantService';

interface ContentDisplayAreaProps {
  contentRef: React.RefObject<HTMLDivElement>;
  draft: string;
  isGenerating: boolean;
  loadingMessage: string;
  citations?: any[];
  researchSources?: any[];
  assistantOn: boolean;
  waSuggestion: WASuggestion | null;
  waError?: string | null;
  showContinuePrompt?: boolean;
  onDraftChange: (value: string) => void;
  onDismissSuggestion: () => void;
  onTextSelection: () => void;
  renderSelectionMenu: () => React.ReactNode;
  onTriggerSuggestion?: (text: string, caretIndex?: number) => void;
  onInsertWithPreview?: (text: string, caretIndex: number) => void;
  onContinueWriting?: () => void;
}

const ContentDisplayArea: React.FC<ContentDisplayAreaProps> = ({
  contentRef,
  draft,
  isGenerating,
  loadingMessage,
  citations,
  researchSources,
  assistantOn,
  waSuggestion,
  waError,
  showContinuePrompt,
  onDraftChange,
  onDismissSuggestion,
  onTextSelection,
  renderSelectionMenu,
  onTriggerSuggestion,
  onInsertWithPreview,
  onContinueWriting
}) => {
  const [localDraft, setLocalDraft] = useState<string>(draft);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caretRect, setCaretRect] = useState<{ top: number; left: number } | null>(null);
  const [currentCaretIndex, setCurrentCaretIndex] = useState<number>(0);

  const updateCaretRect = (el: HTMLTextAreaElement) => {
    const index = el.selectionStart ?? 0;
    setCurrentCaretIndex(index);
    
    const container = contentRef.current as HTMLDivElement | null;
    const containerRect = container?.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const lineHeight = 22;
    const textUntilCaret = el.value.slice(0, index);
    const lines = textUntilCaret.split('\n');
    const lastLine = lines[lines.length - 1];
    const approxCharWidth = 7.2;

    const caretTopViewport = elRect.top + 12 + (lines.length - 1) * lineHeight;
    const caretLeftViewport = elRect.left + 12 + lastLine.length * approxCharWidth;

    if (containerRect) {
      const top = caretTopViewport - containerRect.top + (container?.scrollTop || 0);
      const left = caretLeftViewport - containerRect.left + (container?.scrollLeft || 0);
      setCaretRect({ top, left });
    } else {
      setCaretRect({ top: caretTopViewport + window.scrollY, left: caretLeftViewport + window.scrollX });
    }
  };

  // Memoize the formatted content to prevent infinite re-rendering
  const formattedContent = useMemo(() => {
    if (!draft) return '';
    return formatDraftContent(draft, citations, researchSources);
  }, [draft, citations, researchSources]);

  // Keep local textarea in sync with external updates (including confirmed diffs)
  useEffect(() => {
    if (draft !== localDraft) {
      setLocalDraft(draft);
    }
  }, [draft, localDraft]);

  // Auto-size textarea to show all content
  useEffect(() => {
    if (textareaRef.current && assistantOn) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localDraft, assistantOn]);

  // Cleanup debounced saver
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    };
  }, []);

  return (
    <div 
      ref={contentRef}
      onMouseUp={assistantOn ? undefined : onTextSelection}
      style={{ 
        padding: '20px',
        lineHeight: '1.6',
        position: 'relative',
        userSelect: 'text',
        overflow: 'visible'
      }}
    >
      {/* Inline Writing Suggestion Card (anchored near caret when editing) */}
      <WritingAssistantCard
        assistantOn={assistantOn}
        waSuggestion={waSuggestion}
        waError={waError}
        showContinuePrompt={showContinuePrompt}
        draft={draft}
        onDraftChange={onDraftChange}
        onDismissSuggestion={onDismissSuggestion}
        anchor={assistantOn ? caretRect : null}
        caretIndex={currentCaretIndex}
        onInsertAtCaret={onInsertWithPreview}
        onContinueWriting={onContinueWriting}
      />

      {/* Loading State */}
      {isGenerating && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 10
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e1f5fe',
            borderTop: '3px solid #0a66c2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }} />
          <div style={{ 
            color: '#0277bd', 
            fontSize: '16px', 
            fontWeight: '500',
            marginBottom: '8px'
          }}>
            {loadingMessage || 'Generating LinkedIn content...'}
          </div>
          <div style={{ 
            color: '#666', 
            fontSize: '14px',
            maxWidth: '300px',
            lineHeight: '1.4'
          }}>
            Crafting professional content tailored to your industry and audience...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Content Display */}
      <div style={{
        opacity: isGenerating ? 0.3 : 1,
        transition: 'opacity 0.3s ease'
      }}>
        {draft ? (
          <div>
            {assistantOn ? (
              <textarea
                ref={textareaRef}
                value={localDraft}
                onChange={(e) => {
                  const value = e.target.value;
                  setLocalDraft(value);

                  const caretIndex = e.target.selectionStart ?? value.length;
                  // Debounce suggestion trigger to avoid per-keystroke calls
                  if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
                  if (onTriggerSuggestion) {
                    suggestionTimerRef.current = setTimeout(() => {
                      onTriggerSuggestion(value, caretIndex);
                    }, 800);
                  }

                  // Update caret rect for popover placement
                  updateCaretRect(e.currentTarget);

                  // If user is typing while a suggestion is visible, hide it immediately
                  if (waSuggestion && onDismissSuggestion) {
                    onDismissSuggestion();
                  }

                  // Debounce the draft save
                  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = setTimeout(() => {
                    onDraftChange(value);
                  }, 600);
                }}
                onKeyUp={(e) => updateCaretRect(e.currentTarget)}
                autoFocus
                style={{
                  width: '100%',
                  outline: 'none',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '12px',
                  background: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  resize: 'vertical'
                }}
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
            )}
          </div>
        ) : (
          <p style={{
            color: '#666', 
            fontStyle: 'italic', 
            textAlign: 'center', 
            marginTop: '40px'
          }}>
            Content will appear here when generated. Use the AI assistant to create your LinkedIn content.
          </p>
        )}
        
        {/* Citation Styling */}
        <style>{`
          .liw-cite {
            background: linear-gradient(135deg, #e3f2fd, #bbdefb);
            border: 1px solid #64b5f6;
            border-radius: 4px;
            padding: 2px 6px;
            margin: 0 2px;
            font-size: 0.8em;
            font-weight: 600;
            color: #1976d2;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(25, 118, 210, 0.1);
          }
          .liw-cite:hover {
            background: linear-gradient(135deg, #bbdefb, #90caf9);
            border-color: #42a5f5;
            box-shadow: 0 4px 8px rgba(25, 118, 210, 0.2);
            transform: translateY(-1px);
          }
          .liw-cite:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(25, 118, 210, 0.1);
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        {/* Text Selection Menu and Fact-Check Components (disabled while editing) */}
        {!assistantOn && renderSelectionMenu()}
      </div>
    </div>
  );
};

export default ContentDisplayArea;
