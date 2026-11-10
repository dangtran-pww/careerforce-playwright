import { useId, useState } from 'react';
import type { Plan } from '../api/types';
import { inline } from '../lib/inline';
import { ToggleButton } from './ToggleButton';

// A plan's overview: its first paragraph, with a button to show the rest of
// the "## Overview" section (bullet lists and further paragraphs) and to
// fold it away again. Just the summary when there is nothing more to show.
export function PlanOverview({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const blocks = plan.overview ?? [];
  const more = blocks.length > 1;
  if (!plan.summary && !blocks.length) return null;

  return (
    <div className="plan-overview">
      <div id={id}>
        {open && more ? (
          blocks.map((b, i) =>
            b.kind === 'p' ? (
              <p key={i}>{inline(b.text)}</p>
            ) : (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            ),
          )
        ) : (
          <p>{plan.summary}</p>
        )}
      </div>
      {more && (
        <ToggleButton
          open={open}
          controls={id}
          onToggle={() => setOpen((o) => !o)}
        >
          {open ? 'Show less' : 'Show full overview'}
        </ToggleButton>
      )}
    </div>
  );
}
