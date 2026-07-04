import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import MarkdownToolbar from './MarkdownToolbar';
import {
  applyMarkdownFormat,
  type MarkdownFormatType,
  DEFAULT_MARKDOWN_TOOLBAR_BUTTONS,
} from './markdownFormatting';

export interface RichTextEditorHandle {
  focus: () => void;
  textarea: HTMLTextAreaElement | null;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  buttons?: MarkdownFormatType[];
  textareaStyle?: React.CSSProperties;
  toolbarSx?: object;
  showToolbar?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

const defaultTextareaStyle: React.CSSProperties = {
  width: '100%',
  outline: 'none',
  border: '1px solid #e0e0e0',
  borderRadius: '0 0 8px 8px',
  padding: '12px',
  background: '#fff',
  fontFamily: 'inherit',
  fontSize: '14px',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap',
  resize: 'vertical',
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  (
    {
      value,
      onChange,
      buttons = DEFAULT_MARKDOWN_TOOLBAR_BUTTONS,
      textareaStyle,
      toolbarSx,
      showToolbar = true,
      autoFocus,
      placeholder,
      onKeyUp,
      onKeyDown,
      onMouseUp,
      onSelect,
      className,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        textarea: textareaRef.current,
      }),
      [],
    );

    const handleFormat = useCallback(
      (type: MarkdownFormatType) => {
        const textarea = textareaRef.current;
        const result = applyMarkdownFormat(textarea, value, type);
        if (!result) return;
        const { newValue, cursorPos } = result;
        onChange(newValue);
        requestAnimationFrame(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(cursorPos, cursorPos);
          }
        });
      },
      [value, onChange],
    );

    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
        {showToolbar && (
          <MarkdownToolbar onFormat={handleFormat} buttons={buttons} sx={toolbarSx} />
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyUp={onKeyUp}
          onKeyDown={onKeyDown}
          onMouseUp={onMouseUp}
          onSelect={onSelect}
          autoFocus={autoFocus}
          placeholder={placeholder}
          style={{ ...defaultTextareaStyle, ...textareaStyle }}
        />
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;