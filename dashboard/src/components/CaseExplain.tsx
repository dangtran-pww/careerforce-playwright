import { useId, useRef, useState } from 'react';
import { post } from '../api/client';
import type { CaseExplanation, ExplanationResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { modelName } from '../lib/format';
import { TimeAgo } from './TimeAgo';
import { ToggleButton } from './ToggleButton';

// "What the code does": Claude's plain-words account of a case's test code,
// step by step. Shows the saved one if there is one; the button asks Claude
// (claude -p, read-only) to read the code and explain it, which takes about
// a minute. The heading folds the section open and closed, and so does a
// "Show less" button at the bottom, so a long account folds from either end.
export function CaseExplain({
  planSlug,
  caseId,
}: {
  planSlug: string;
  caseId: string;
}) {
  const path = `/api/plans/${planSlug}/cases/${caseId}/explanation`;
  const saved = useApi<ExplanationResponse>(path);
  const [fresh, setFresh] = useState<CaseExplanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const explanation = fresh ?? saved.data?.explanation ?? null;
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Folding from the bottom hides the button just pressed and can leave the
  // page scrolled past the section. Move focus to the heading toggle, which
  // also scrolls it back into view.
  function foldFromBottom() {
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }

  async function explain(refresh: boolean) {
    setBusy(true);
    setOpen(true);
    setError(null);
    try {
      const res = await post<ExplanationResponse>(path, { refresh });
      setFresh(res.explanation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="case-explain" aria-label={`What ${caseId}'s code does`}>
      <div className="case-explain-head">
        <h4>
          <button
            type="button"
            ref={toggleRef}
            className="case-explain-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
          >
            What the code does
          </button>
        </h4>
        {saved.loading && !saved.data ? null : (
          <button
            type="button"
            className="ghost small"
            disabled={busy}
            onClick={() => explain(Boolean(explanation))}
          >
            {busy
              ? 'Reading the code…'
              : explanation
                ? 'Explain again'
                : 'Explain the steps'}
          </button>
        )}
      </div>
      <div id={bodyId} hidden={!open}>
        {busy && (
          <p className="note small" role="status">
            Claude is reading the test and the helpers it uses. This takes about
            a minute.
          </p>
        )}
        {error && <p className="callout callout-bad">{error}</p>}
        {!explanation && !busy && !error && (
          <p className="note small">
            Ask Claude to read this case's test code and explain each step it
            performs and what it checks.
          </p>
        )}
        {explanation && (
          <>
            {explanation.stale && (
              <p className="callout callout-warn">
                The test code changed after this was written. Explain again for
                an up-to-date account.
              </p>
            )}
            {explanation.summary && <p>{explanation.summary}</p>}
            <ol className="case-explain-steps">
              {explanation.steps.map((s, i) => (
                <li key={i}>
                  {s.action}
                  {s.checks.length > 0 && (
                    <ul>
                      {s.checks.map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
            {explanation.notes.length > 0 && (
              <ul className="case-explain-notes">
                {explanation.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            <ExplainUsage explanation={explanation} />
            <ToggleButton open controls={bodyId} onToggle={foldFromBottom}>
              Show less
            </ToggleButton>
          </>
        )}
      </div>
    </section>
  );
}

// Who wrote the explanation, when, and what it took: model, tokens in and
// out, cost. Older saved explanations have only the time and cost.
function ExplainUsage({ explanation: e }: { explanation: CaseExplanation }) {
  const n = (x: number) => x.toLocaleString();
  return (
    <p className="note case-explain-usage">
      <span>
        Explained by{' '}
        {e.model ? <span title={e.model}>{modelName(e.model)}</span> : 'Claude'}
        , <TimeAgo iso={e.createdAt} />
      </span>
      {e.tokens && (
        <span
          title={`${n(e.tokens.cached)} of the ${n(e.tokens.in)} input tokens were read from the prompt cache`}
        >
          {n(e.tokens.in)} tokens in · {n(e.tokens.out)} out
        </span>
      )}
      {e.costUsd != null && <span>{usd(e.costUsd)}</span>}
    </p>
  );
}

// Under a cent, show enough digits to not read as $0.00.
const usd = (x: number) =>
  `$${x > 0 && x < 0.01 ? x.toFixed(4) : x.toFixed(2)}`;
