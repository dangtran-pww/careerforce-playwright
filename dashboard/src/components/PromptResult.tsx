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
  const shots = r.screenshots ?? [];
  const baseline = r.baselineScreenshots ?? [];
  const shown = (r.findings ?? []).map((f) =>
    withCompared(findingShots(f, [...shots, ...baseline]), r),
  );
  const used = new Set(shown.flat());
  const others = shots.filter((p) => !used.has(p));
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
            <FindingItem key={i} finding={f} shots={shown[i]} />
          ))}
        </ul>
      )}
      {!!others.length &&
        (used.size ? (
          <details>
            <summary className="note">
              Other screenshots ({others.length})
            </summary>
            <Shots paths={others} />
          </details>
        ) : (
          <Shots paths={others} />
        ))}
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
  if (c.mode === 'site') {
    const sites = c.sites ?? [
      { envId: c.envId, envName: c.envName, baseURL: c.baseURL },
    ];
    return (
      <p className="note">
        Compared side by side with{' '}
        {sites.map((s, i) => (
          <span key={s.envId ?? i}>
            {i > 0 && (i === sites.length - 1 ? ' and ' : ', ')}
            <strong>{s.envName}</strong> ({s.baseURL})
          </span>
        ))}
        .
      </p>
    );
  }
  return (
    <p className="note">
      {c.baselineFrom
        ? `Compared with the baseline: the screenshots of ${c.baselineFrom}.`
        : 'No earlier run to compare with, so Claude reviewed the pages on their own. The next run compares with these screenshots.'}
    </p>
  );
}

// The screenshots a finding names, from `paths` (the run's screenshots,
// then the baseline's). Claude names them by file name, sometimes several
// in one string or with a folder, so match on each name's last part.
function findingShots(f: Finding, paths: string[]): string[] {
  const names = (f.screenshot ?? '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(fileName);
  const found: string[] = [];
  for (const name of names) {
    const path = paths.find((p) => fileName(p) === name);
    if (path && !found.includes(path)) found.push(path);
  }
  return found;
}

const fileName = (path: string) => path.split('/').at(-1) ?? path;

// A screenshot name's parts: "03-home-phone-qa.png" is shot 3, page and
// viewport "home-phone", site "qa" (side-by-side checks); a baseline
// check's "03-home-phone.png" has no site.
function parseShot(path: string, withSite: boolean) {
  const m = fileName(path).match(
    withSite ? /^(\d+)-(.+)-([^-]+)\.\w+$/ : /^(\d+)-(.+)\.\w+$/,
  );
  return m ? { n: Number(m[1]), key: m[2], site: m[3] ?? '' } : null;
}

// `found` plus the matching screenshots of what it was compared with: the
// other sites' shots of the same page and viewport (side by side), or the
// baseline's (baseline). Each site numbers its shots on its own, so of
// several matches take the one numbered nearest.
function withCompared(found: string[], r: Result): string[] {
  const mode = r.compare?.mode;
  if (mode !== 'site' && mode !== 'baseline') return found;
  const site = mode === 'site';
  const pool = site ? (r.screenshots ?? []) : (r.baselineScreenshots ?? []);
  const out = [...found];
  for (const path of found) {
    const me = parseShot(path, site);
    if (!me) continue;
    const best = new Map<string, { path: string; d: number }>();
    for (const other of pool) {
      if (other === path) continue;
      const o = parseShot(other, site);
      if (!o || o.key !== me.key || (site && o.site === me.site)) continue;
      const d = Math.abs(o.n - me.n);
      const cur = best.get(o.site);
      // On a tie, the later one: sites are usually shot in turn.
      if (!cur || d < cur.d || (d === cur.d && o.n > me.n))
        best.set(o.site, { path: other, d });
    }
    for (const { path: p } of best.values()) if (!out.includes(p)) out.push(p);
  }
  return out;
}

function FindingItem({
  finding: f,
  shots,
}: {
  finding: Finding;
  shots: string[];
}) {
  return (
    <li>
      {f.severity === 'problem' ? (
        <span className="badge badge-bad small">Problem</span>
      ) : (
        <span className="badge badge-neutral small">Note</span>
      )}{' '}
      {f.viewport && <span className="note small">[{f.viewport}] </span>}
      {f.text}
      {f.screenshot && !shots.length && (
        <span className="note small"> ({f.screenshot})</span>
      )}
      {!!shots.length && <Shots paths={shots} />}
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
