import type { PlanCase } from '../api/types';
import { plural } from '../lib/format';

// Where a case runs, as one short line under its title: its projects and
// how many tests, e.g. "smoke-desktop, smoke-mobile · 2 tests", so a glance
// shows whether it is tested on desktop, mobile or both. `only` limits them
// to the projects a run uses, e.g. a suite's.
export function CaseProjects({
  testCase,
  only,
}: {
  testCase: PlanCase;
  only?: string[];
}) {
  const projects = testCase.projects.filter(
    (p) => p.testCount > 0 && (!only?.length || only.includes(p.name)),
  );
  const tests = projects.reduce((n, p) => n + p.testCount, 0);
  if (!tests) return <div className="case-meta note">No tests</div>;
  return (
    <div className="case-meta note">
      <span className="mono">{projects.map((p) => p.name).join(', ')}</span>
      {' · '}
      {plural(tests, 'test')}
    </div>
  );
}
