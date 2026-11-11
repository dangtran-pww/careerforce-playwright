// A plan's table cell can only hold one line, so numbered steps are written
// inline: "1. Open … 2. Type …" or "**1.** The page … **2.** The form …".
// This splits such text into its items. It returns null unless the numbers
// run 1, 2, 3 … with at least two items, so a stray "1." in prose is left
// alone. Text before "1." is kept as the intro.
export interface Numbered {
  intro: string;
  items: string[];
}

const MARKER = /(?:^|\s)(?:\*\*(\d+)\.\*\*|(\d+)\.)(?=\s)/g;

export function splitNumbered(text: string): Numbered | null {
  const marks: { n: number; start: number; end: number }[] = [];
  for (const m of text.matchAll(MARKER)) {
    const n = Number(m[1] ?? m[2]);
    if (n !== marks.length + 1) continue; // not the next number: plain text
    marks.push({ n, start: m.index, end: m.index + m[0].length });
  }
  if (marks.length < 2) return null;
  return {
    intro: text.slice(0, marks[0].start).trim(),
    items: marks.map((m, i) =>
      text.slice(m.end, marks[i + 1]?.start ?? text.length).trim(),
    ),
  };
}
