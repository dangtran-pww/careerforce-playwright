import type { A11yJourney as Journey } from '../api/types';
import { plural } from '../lib/format';
import { A11yPageRow } from './A11yPageRow';

// What a run's accessibility scans found: every page pattern its tests or
// Claude reached, worst first. Patterns turn IDs into {id}, so
// /user/123/edit and /user/456/edit are one page.
export function A11yJourney({ journey }: { journey: Journey }) {
  const broken = journey.pages.reduce((n, p) => n + p.violations.length, 0);
  return (
    <section aria-labelledby="a11y-heading">
      <h2 id="a11y-heading" className="section-title">
        Accessibility
      </h2>
      <p className="note">
        {plural(journey.pages.length, 'page')} ·{' '}
        {plural(journey.scanned, 'page state')} scanned (WCAG 2.2 A/AA) ·{' '}
        {broken ? `${plural(broken, 'rule')} broken` : 'no rule broken'}
        {journey.interrupted > 0 &&
          ` · ${plural(journey.interrupted, 'scan')} cut short when the page moved on`}
        . Each page state is scanned once per run.
      </p>
      {journey.pages.map((p) => (
        <A11yPageRow key={p.pattern} page={p} />
      ))}
    </section>
  );
}
