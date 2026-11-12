import type { Finding, PromptResult as Result } from '../api/types';
import { duration, modelName, plural } from '../lib/format';
import { runFile } from '../lib/runs';

// One Claude check's result: who it ran as, what it compared with, the
// prompt, then Claude's summary, findings and screenshots. Used for a
// suite's prompt steps and for a plan's prompt cases.
export function PromptResult({
  result: r,
  promptOpen = true,
}: {
  result: Result;
  promptOpen?: boolean;
}) {
  return (
    <>
      <p className="note">
        {r.role ? `As ${r.role}` : 'As an anonymous visitor'}
        {r.viewports?.length
          ? `, at ${r.viewports.map((v) => `${v.name} ${v.width}×${v.height}`).join(' and ')}`
          : ''}
        {r.file ? ` (${r.file})` : ''}.
      </p>
      <CompareNote result={r} />
      {r.prompt &&
        (promptOpen ? (
          <pre className="prompt-text">{r.prompt}</pre>
        ) : (
          <details>
            <summary className="note">The prompt</summary>
            <pre className="prompt-text">{r.prompt}</pre>
          </details>
        ))}
      {r.status === 'running' && (
        <p className="note">
          Claude is checking the site. Its actions show in the Output panel.
        </p>
      )}
      {r.summary && (
        <p>
          <strong>{r.summary}</strong>
        </p>
      )}
      {!!r.findings?.length && (
        <ul className="findings">
          {r.findings.map((f, i) => (
            <FindingItem key={i} finding={f} />
          ))}
        </ul>
      )}
      {!!r.screenshots?.length && <Shots paths={r.screenshots} />}
      {!!r.baselineScreenshots?.length && (
        <details>
          <summary className="note">
            The baseline it compared with ({r.baselineScreenshots.length})
          </summary>
          <Shots paths={r.baselineScreenshots} />
        </details>
      )}
      <UsageNote result={r} />
    </>
  );
}

// What the check took: model, turns, tokens, cost and time. Older results
// have only turns and cost.
function UsageNote({ result: r }: { result: Result }) {
  const n = (x: number) => x.toLocaleString();
  const parts = [
    r.model && modelName(r.model),
    r.turns != null && plural(r.turns, 'turn'),
    r.tokens && (
      <span
        key="tokens"
        title={`${n(r.tokens.cached)} of the ${n(r.tokens.in)} input tokens were read from the prompt cache`}
      >
        {n(r.tokens.in)} tokens in · {n(r.tokens.out)} out
      </span>
    ),
    r.costUsd != null && `$${r.costUsd.toFixed(2)}`,
    r.durationMs != null && duration(r.durationMs),
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="note small">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </p>
  );
}

function CompareNote({ result: r }: { result: Result }) {
  const c = r.compare;
  if (!c || c.mode === 'none') return null;
  if (c.mode === 'site')
    return (
      <p className="note">
        Compared side by side with <strong>{c.envName}</strong> ({c.baseURL}).
      </p>
    );
  return (
    <p className="note">
      {c.baselineFrom
        ? `Compared with the baseline: the screenshots of ${c.baselineFrom}.`
        : 'No earlier run to compare with, so Claude reviewed the pages on their own. The next run compares with these screenshots.'}
    </p>
  );
}

function FindingItem({ finding: f }: { finding: Finding }) {
  return (
    <li>
      {f.severity === 'problem' ? (
        <span className="badge badge-bad small">Problem</span>
      ) : (
        <span className="badge badge-neutral small">Note</span>
      )}{' '}
      {f.viewport && <span className="note small">[{f.viewport}] </span>}
      {f.text}
      {f.screenshot && <span className="note small"> ({f.screenshot})</span>}
    </li>
  );
}

function Shots({ paths }: { paths: string[] }) {
  return (
    <div className="shots">
      {paths.map((path) => (
        <Thumbnail key={path} path={path} />
      ))}
    </div>
  );
}

function Thumbnail({ path }: { path: string }) {
  const name = path.split('/').at(-1);
  return (
    <a href={runFile(path)} target="_blank" rel="noopener">
      <img src={runFile(path)} alt={`Screenshot ${name}`} loading="lazy" />
      {name}
    </a>
  );
}
