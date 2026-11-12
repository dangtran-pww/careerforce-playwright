import { useState } from 'react';
import type { PromptResult as Result } from '../api/types';
import { duration, elapsed } from '../lib/format';
import { STEP_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { ErrorBox } from './Callouts';
import { PromptResult } from './PromptResult';

// Results in these states start open.
const NEEDS_A_LOOK = ['failed', 'error', 'unsure'];

// A plan's prompt cases in a run, each a collapsible section with its status
// and Claude's result. They run after the plan's tests.
export function PromptCases({ prompts }: { prompts: Result[] }) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  if (!prompts.length) return null;

  return (
    <section aria-labelledby="prompt-cases-heading">
      <h3 id="prompt-cases-heading" className="section-title">
        Prompt cases (checked by Claude)
      </h3>
      <div className="steps">
        {prompts.map((p) => {
          const key = p.id ?? p.title ?? '';
          return (
            <details
              key={key}
              className="step"
              open={toggled[key] ?? NEEDS_A_LOOK.includes(p.status)}
              onToggle={(e) => {
                const open = e.currentTarget.open;
                setToggled((t) =>
                  t[key] === open ? t : { ...t, [key]: open },
                );
              }}
            >
              <summary>
                <span className="step-title">{p.title}</span>
                {p.startedAt && (
                  <span className="note small">
                    {duration(elapsed(p.startedAt, p.finishedAt))}
                  </span>
                )}
                <Badge map={STEP_STATUS} value={p.status} />
              </summary>
              <div className="step-body">
                {p.status === 'pending' ? (
                  <p className="note">Runs after the tests.</p>
                ) : p.status === 'skipped' ? (
                  <p className="note">{p.skipReason ?? 'Skipped.'}</p>
                ) : (
                  <>
                    {p.error && <ErrorBox>{p.error}</ErrorBox>}
                    <PromptResult result={p} promptOpen={false} />
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
