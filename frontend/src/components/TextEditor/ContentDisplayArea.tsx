import React from 'react';
import { LinkedInDraftPreview } from '../LinkedInWriter/components/LinkedInDraftPreview';
import { LinkedInAssistiveEditor, type LinkedInAssistiveEditorHandle } from '../LinkedInWriter/components/LinkedInAssistiveEditor';
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
  assistiveEditorRef?: React.Ref<LinkedInAssistiveEditorHandle>;
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
  assistiveEditorRef,
}) => {
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
              <LinkedInAssistiveEditor
                ref={assistiveEditorRef}
                draft={draft}
                onDraftChange={onDraftChange}
                onTypingChange={onTypingChange}
                onTextareaSelection={onTextareaSelection}
              />
            ) : (
              <LinkedInDraftPreview
                draft={draft}
                citations={citations}
                researchSources={researchSources}
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
