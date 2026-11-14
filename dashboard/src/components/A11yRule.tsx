import type { A11yViolation } from '../api/types';
import { plural } from '../lib/format';
import { A11Y_IMPACT } from '../lib/status';
import { Badge } from './Badge';

// One broken accessibility rule on a page: what's wrong, how to fix it, and
// the elements it was found on (the first 20), each with where it was seen.
export function A11yRule({ violation: v }: { violation: A11yViolation }) {
  return (
    <details className="a11y-rule">
      <summary>
        <Badge map={A11Y_IMPACT} value={v.impact ?? 'minor'} />{' '}
        <strong>{v.help}</strong>{' '}
        <span className="note small">
          {v.id} · {plural(v.count, 'element')}
          {v.tags.length > 0 && ` · ${v.tags.join(', ')}`}
        </span>
      </summary>
      <p className="small">
        <a href={v.helpUrl} target="_blank" rel="noopener">
          How to fix it (Deque)
        </a>
      </p>
      <ol className="a11y-nodes">
        {v.nodes.map((n) => (
          <li key={n.target}>
            <code>{n.target}</code>
            {n.url && (
              <div className="note small">
                Seen at <a href={n.url}>{n.url}</a>
              </div>
            )}
            <pre className="a11y-html">{n.html}</pre>
            {n.summary && <p className="note small">{n.summary}</p>}
          </li>
        ))}
      </ol>
      {v.count > v.nodes.length && (
        <p className="note small">
          …and {v.count - v.nodes.length} more. See the Playwright report.
        </p>
      )}
    </details>
  );
}
