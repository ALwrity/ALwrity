export type MarkdownFormatType =
  | 'bold'
  | 'italic'
  | 'link'
  | 'heading-2'
  | 'heading-3'
  | 'bullet-list'
  | 'numbered-list'
  | 'blockquote'
  | 'code'
  | 'hr';

export interface MarkdownFormatResult {
  newValue: string;
  replacement: string;
  cursorPos: number;
  start: number;
  end: number;
}

export function applyMarkdownFormat(
  textarea: HTMLTextAreaElement | null,
  value: string,
  type: MarkdownFormatType,
  overrideStart?: number,
  overrideEnd?: number,
): MarkdownFormatResult | null {
  if (!textarea) return null;

  const start = overrideStart ?? textarea.selectionStart;
  const end = overrideEnd ?? textarea.selectionEnd;
  const selected = value.substring(start, end);
  const trimmed = selected.trim();
  let replacement = '';
  let cursorPos = start + replacement.length;

  switch (type) {
    case 'bold': {
      const outerMatch = trimmed.match(/^\*\*(.+)\*\*$/s);
      replacement = outerMatch ? outerMatch[1] : `**${trimmed.replace(/\*\*/g, '')}**`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'italic': {
      const outerMatch = trimmed.match(/^\*(?!\*)(.+)(?<!\*)\*$/s);
      replacement = outerMatch ? outerMatch[1] : `*${trimmed.replace(/\*/g, '')}*`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'link': {
      replacement = trimmed ? `[${trimmed}](url)` : `[text](url)`;
      cursorPos = trimmed ? start + replacement.length - 5 : start + 1;
      break;
    }
    case 'heading-2': {
      replacement = trimmed ? `## ${trimmed}` : `## Heading`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'heading-3': {
      replacement = trimmed ? `### ${trimmed}` : `### Heading`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'bullet-list': {
      replacement = trimmed ? `- ${trimmed}` : `- List item`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'numbered-list': {
      replacement = trimmed ? `1. ${trimmed}` : `1. List item`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'blockquote': {
      replacement = trimmed ? `> ${trimmed}` : `> Quote`;
      cursorPos = start + replacement.length;
      break;
    }
    case 'code': {
      const outerMatch = trimmed.match(/^`(.+)`$/s);
      replacement = outerMatch ? outerMatch[1] : `\`${trimmed.replace(/`/g, '')}\``;
      cursorPos = start + replacement.length;
      break;
    }
    case 'hr': {
      replacement = `\n\n---\n\n`;
      cursorPos = start + replacement.length;
      break;
    }
    default:
      return null;
  }

  const newValue = value.substring(0, start) + replacement + value.substring(end);
  return { newValue, replacement, cursorPos, start, end };
}

export const DEFAULT_MARKDOWN_TOOLBAR_BUTTONS: MarkdownFormatType[] = [
  'bold',
  'italic',
  'link',
  'heading-2',
  'heading-3',
  'bullet-list',
  'numbered-list',
  'blockquote',
  'code',
  'hr',
];