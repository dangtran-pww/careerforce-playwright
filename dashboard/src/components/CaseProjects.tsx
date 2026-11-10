import type { PlanCase } from '../api/types';

// The projects that run a case, one per line (e.g. smoke-desktop,
// smoke-mobile), so a glance shows whether it is tested on desktop, mobile or
// both. `only` limits them to the projects a run uses, e.g. a suite's.
export function CaseProjects({
  testCase,
  only,
}: {
  testCase: PlanCase;
  only?: string[];
}) {
  const projects = testCase.projects.filter(
    (p) => !only?.length || only.includes(p.name),
  );
  if (!projects.length) return <span className="note">none</span>;
  return (
    <span className="mono">
      {projects.map((p) => (
        <div key={p.name} title={`${p.testCount} test(s)`}>
          {p.name}
        </div>
      ))}
    </span>
  );
}
