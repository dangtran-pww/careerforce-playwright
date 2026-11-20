import { inline } from '../lib/inline';

const BULLET = /^- /;
const NUMBER = /^\d+\. /;

// A prompt file's "## Prompt" or "## Expected result" Markdown, simply:
// paragraphs, "- " lists and "1. " lists, with inline `code` and **bold**.
// Lines within a paragraph or list item are joined, so the text fills the
// width it has instead of keeping the file's line breaks. With `numbered`,
// every paragraph is shown as an item of one numbered list, so each
// expectation is numbered even when the file has only one, as plain text.
export function PromptBody({
  text,
  numbered = false,
}: {
  text: string;
  numbered?: boolean;
}) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  if (numbered) {
    const items = blocks.flatMap((block) => {
      const lines = block.split('\n');
      return NUMBER.test(lines[0].trimStart())
        ? listItems(lines, NUMBER)
        : [lines.join(' ').trim()];
    });
    return (
      <div className="prompt-body">
        <ol>
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="prompt-body">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const first = lines[0].trimStart();
        const marker = BULLET.test(first)
          ? BULLET
          : NUMBER.test(first)
            ? NUMBER
            : null;
        if (!marker) return <p key={i}>{inline(lines.join(' ').trim())}</p>;
        const items = listItems(lines, marker).map((item, j) => (
          <li key={j}>{inline(item)}</li>
        ));
        return marker === BULLET ? (
          <ul key={i}>{items}</ul>
        ) : (
          <ol key={i}>{items}</ol>
        );
      })}
    </div>
  );
}

// A list item runs on until the next line that starts with the marker.
function listItems(lines: string[], marker: RegExp) {
  const items: string[] = [];
  for (const line of lines) {
    const t = line.trimStart();
    if (marker.test(t)) items.push(t.replace(marker, ''));
    else if (items.length) items[items.length - 1] += ` ${line.trim()}`;
    else items.push(line.trim());
  }
  return items.map((item) => item.trim());
}
