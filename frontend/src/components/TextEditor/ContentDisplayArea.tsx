import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { formatDraftContent } from '../LinkedInWriter/utils/contentFormatters';
import MarkdownToolbar from './MarkdownToolbar';
import { applyMarkdownFormat, type MarkdownFormatType } from './markdownFormatting';
import LinkedInAssistiveWritingCard from '../LinkedInWriter/components/LinkedInAssistiveWritingCard';
import type { LinkedInAssistiveSuggestion } from '../LinkedInWriter/services/linkedInAssistiveWritingApi';

interface AssistiveWritingState {
  suggestion: LinkedInAssistiveSuggestion | null;
  error: string | null;
  isGenerating: boolean;
  showContinuePrompt: boolean;
  suggestionIndex: number;
  totalSuggestions: number;
  onAccept: () => void;
  onReject: () => void;
  onNext: () => void;
  onContinueWriting: () => void;
  onDismiss: () => void;
}

interface ContentDisplayAreaProps {
  contentRef: React.RefObject<HTMLDivElement>;
  draft: string;
  isGenerating: boolean;
  loadingMessage: string;
  citations?: any[];
  researchSources?: any[];
  assistantOn: boolean;
  assistiveWriting?: AssistiveWritingState;
  onDraftChange: (value: string) => void;
  onTextareaSelection?: (textarea: HTMLTextAreaElement) => void;
  renderSelectionMenu: () => React.ReactNode;
  onTypingChange?: (text: string, caretIndex?: number) => void;
}

const ContentDisplayArea: React.FC<ContentDisplayAreaProps> = ({
  contentRef,
  draft,
  isGenerating,
  loadingMessage,
  citations,
  researchSources,
  assistantOn,
  assistiveWriting,
  onDraftChange,
  onTextareaSelection,
  renderSelectionMenu,
  onTypingChange,
}) => {
  const [localDraft, setLocalDraft] = useState<string>(draft);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastEmittedDraftRef = useRef<string>(draft);

  const handleFormat = useCallback(
    (type: MarkdownFormatType) => {
      const textarea = textareaRef.current;
      const result = applyMarkdownFormat(textarea, localDraft, type);
      if (!result) return;
      const { newValue, cursorPos } = result;

      setLocalDraft(newValue);

      if (onDraftChange) {
        lastEmittedDraftRef.current = newValue;
        onDraftChange(newValue);
      }

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [localDraft, onDraftChange],
  );

  const formattedContent = useMemo(() => {
    if (!draft) return '';
    return formatDraftContent(draft, citations, researchSources);
  }, [draft, citations, researchSources]);

  useEffect(() => {
    if (draft !== lastEmittedDraftRef.current) {
      setLocalDraft(draft);
      lastEmittedDraftRef.current = draft;
    }
  }, [draft]);

  useEffect(() => {
    if (textareaRef.current && assistantOn) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [localDraft, assistantOn]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTextareaSelectionEvent = useCallback(() => {
    if (!assistantOn || !textareaRef.current) return;
    onTextareaSelection?.(textareaRef.current);
  }, [assistantOn, onTextareaSelection]);

  return (
    <div
      ref={contentRef}
      style={{
        padding: '20px',
        lineHeight: '1.6',
        position: 'relative',
        userSelect: 'text',
        overflow: 'visible',
        color: '#333',
      }}
    >
      {assistiveWriting && (
        <LinkedInAssistiveWritingCard
          enabled={assistantOn}
          suggestion={assistiveWriting.suggestion}
          error={assistiveWriting.error}
          isGenerating={assistiveWriting.isGenerating}
          showContinuePrompt={assistiveWriting.showContinuePrompt}
          suggestionIndex={assistiveWriting.suggestionIndex}
          totalSuggestions={assistiveWriting.totalSuggestions}
          onAccept={assistiveWriting.onAccept}
          onReject={assistiveWriting.onReject}
          onNext={assistiveWriting.onNext}
          onContinueWriting={assistiveWriting.onContinueWriting}
          onDismiss={assistiveWriting.onDismiss}
        />
      )}

      {isGenerating && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e1f5fe',
              borderTop: '3px solid #0a66c2',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto',
            }}
          />
          <div style={{ color: '#0277bd', fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
            {loadingMessage || 'Generating LinkedIn content...'}
          </div>
          <div style={{ color: '#666', fontSize: '14px', maxWidth: '300px', lineHeight: '1.4' }}>
            Crafting professional content tailored to your industry and audience...
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ opacity: isGenerating ? 0.3 : 1, transition: 'opacity 0.3s ease' }}>
        {draft ? (
          <div>
            {assistantOn ? (
              <div>
                <MarkdownToolbar onFormat={handleFormat} />
                <textarea
                  ref={textareaRef}
                  value={localDraft}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalDraft(value);

                    const caretIndex = e.target.selectionStart ?? value.length;
                    onTypingChange?.(value, caretIndex);

                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = setTimeout(() => {
                      lastEmittedDraftRef.current = value;
                      onDraftChange(value);
                    }, 600);
                  }}
                  onMouseUp={handleTextareaSelectionEvent}
                  onKeyUp={handleTextareaSelectionEvent}
                  autoFocus
                  style={{
                    width: '100%',
                    outline: 'none',
                    border: '1px solid #e2e8f0',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '12px',
                    background: '#fff',
                    color: '#333',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    resize: 'vertical',
                  }}
                />
              </div>
            ) : (
              <div
                dangerouslySetInnerHTML={{ __html: formattedContent }}
                style={{ userSelect: 'text' }}
              />
            )}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
            Content will appear here when generated. Use the AI assistant to create your LinkedIn content.
          </p>
        )}

        <style>{`
          .liw-cite {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 18px;
            padding: 0 5px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
            color: #0a66c2;
            background: rgba(10, 102, 194, 0.1);
            border: 1px solid rgba(10, 102, 194, 0.25);
            border-radius: 4px;
            cursor: pointer;
            vertical-align: super;
          }
        `}</style>

        {assistantOn && renderSelectionMenu()}
      </div>
    </div>
  );
};

export default ContentDisplayArea;
