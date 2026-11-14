import type { A11yPage } from '../api/types';
import { plural } from '../lib/format';
import { A11Y_IMPACT } from '../lib/status';
import { A11yRule } from './A11yRule';
import { Badge } from './Badge';

// One page pattern of a journey (e.g. /user/{id}/edit): its worst problem,
// the rules broken on it, and the visits that reached it.
export function A11yPageRow({ page }: { page: A11yPage }) {
  const worst =
    page.violations[0]?.impact ?? (page.violations.length ? 'minor' : 'none');
  return (
    <details className="card a11y-page">
      <summary>
        <Badge map={A11Y_IMPACT} value={worst} /> <code>{page.pattern}</code>{' '}
        <span className="note small">
          {page.violations.length
            ? plural(page.violations.length, 'rule') + ' broken'
            : 'nothing broken'}{' '}
          · {plural(page.visits.length, 'visit')}
          {page.titles[0] && ` · ${page.titles[0]}`}
        </span>
      </summary>
      {page.dialogs.length > 0 && (
        <p className="small">
          Dialogs scanned: {page.dialogs.map((d) => `“${d}”`).join(', ')}
        </p>
      )}
      {page.violations.map((v) => (
        <A11yRule key={v.id} violation={v} />
      ))}
      <details className="a11y-visits">
        <summary className="small">Where it was reached</summary>
        <ul className="small">
          {page.visits.map((v, i) => (
            <li key={i}>
              <a href={v.url}>{v.url}</a>
              {v.dialog && ` (dialog “${v.dialog}”)`}
              {v.width ? ` at ${v.width}px` : ''}
              <span className="note">
                {' '}
                — {v.step ? `step ${v.step}, ` : ''}
                {v.test} ({v.project})
              </span>
            </li>
          ))}
        </ul>
      </details>
    </details>
  );
}
