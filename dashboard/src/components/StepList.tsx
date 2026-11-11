import { inline } from '../lib/inline';
import type { Numbered } from '../lib/numbered';

// A numbered detail (e.g. Steps) as a real list, with any text before "1."
// above it.
export function StepList({ numbered }: { numbered: Numbered }) {
  return (
    <>
      {numbered.intro && <p className="step-intro">{inline(numbered.intro)}</p>}
      <ol className="step-list">
        {numbered.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ol>
    </>
  );
}
