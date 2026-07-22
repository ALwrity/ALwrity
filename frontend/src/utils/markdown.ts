import { marked } from 'marked';

export const renderMarkdown = (md: string): string => {
  if (!md) return '';
  try {
    const html = marked.parse(md);
    return typeof html === 'string' ? html : '';
  } catch {
    return md;
  }
};
