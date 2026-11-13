import { inline } from '../lib/inline';

// A prompt file's "## Prompt" Markdown, simply: paragraphs and "- " lists,
// with inline `code` and **bold**. Lines within a paragraph or list item are
// joined, so the text fills the width it has instead of keeping the file's
// line breaks.
export function PromptBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="prompt-body">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (!lines[0].trimStart().startsWith('- '))
          return <p key={i}>{inline(lines.join(' ').trim())}</p>;
        // A list item runs on until the next "- ".
        const items: string[] = [];
        for (const line of lines) {
          if (line.trimStart().startsWith('- '))
            items.push(line.trimStart().slice(2));
          else items[items.length - 1] += ` ${line.trim()}`;
        }
        return (
          <ul key={i}>
            {items.map((item, j) => (
              <li key={j}>{inline(item.trim())}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
