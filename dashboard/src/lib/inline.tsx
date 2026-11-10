import type { ReactNode } from 'react';

// The plans' inline Markdown: `code` and **bold**. Anything else stays text.
export function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : part.startsWith('**') && part.endsWith('**') && part.length > 3 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}
