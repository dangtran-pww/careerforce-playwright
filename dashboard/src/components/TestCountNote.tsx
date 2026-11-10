import type { PlanProject } from '../api/types';
import { plural, testsPerProject } from '../lib/format';

// Says why a plan has more tests than cases: a case can have several tests,
// and each test runs once in every project (desktop, mobile…). Counts the
// projects a run uses by default.
export function TestCountNote({
  caseCount,
  projects,
}: {
  caseCount: number;
  projects: PlanProject[];
}) {
  const run = projects.filter((p) => p.selected);
  const tests = run.reduce((n, p) => n + p.testCount, 0);
  if (!run.length) return null;

  return (
    <p className="note">
      {plural(caseCount, 'case')} run as {plural(tests, 'Playwright test')}
      {run.length > 1 ? `: ${testsPerProject(run)}. ` : ` on ${run[0].name}. `}A
      case can have more than one test
      {run.length > 1 &&
        ', and each test runs once per project, so the Tests column adds up every project'}
      .
    </p>
  );
}
