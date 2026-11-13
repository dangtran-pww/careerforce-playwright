import type { PlanCase, RoleCases } from '../api/types';

// True when every case of the plan logs in as this role.
const forAll = (rc: RoleCases, all: string[]) =>
  all.length > 0 && all.every((id) => rc.cases.includes(id));

// A plan's logins: "Login: admin" when every case needs one, "No login /
// Login: jobseeker" when some cases need none.
export function PlanLogins({
  roleCases,
  caseIds,
  roles,
}: {
  roleCases?: RoleCases[];
  caseIds?: string[];
  roles?: string[]; // older servers send only these
}) {
  if (!roleCases || !caseIds)
    return (
      <span className="note small">
        {roles?.length ? `Login: ${roles.join(', ')}` : 'No login'}
      </span>
    );
  if (!roleCases.length) return <span className="note small">No login</span>;
  const names = roleCases.map((rc) => rc.role).join(', ');
  // Some cases run with no login: "No login / Login: jobseeker", with the
  // cases that need each login on hover.
  const withLogin = new Set(roleCases.flatMap((rc) => rc.cases));
  const someWithout = caseIds.some((id) => !withLogin.has(id));
  const partial = roleCases.some((rc) => !forAll(rc, caseIds));
  return (
    <span
      className="note small"
      title={
        partial
          ? roleCases
              .map(
                (rc) =>
                  `${rc.role}: ${forAll(rc, caseIds) ? 'every case' : rc.cases.join(', ')}`,
              )
              .join('\n')
          : undefined
      }
    >
      {someWithout ? `No login / Login: ${names}` : `Login: ${names}`}
    </span>
  );
}

// The plan details' "Logins" line: each role with the cases that need it.
export function loginsFact(roleCases: RoleCases[], caseIds: string[]) {
  if (!roleCases.length) return 'none';
  return roleCases.map((rc) => (
    <div key={rc.role}>
      {rc.role}
      {forAll(rc, caseIds) ? ' (every case)' : `: ${rc.cases.join(', ')}`}
    </div>
  ));
}

// "Login: jobseeker" on a case that logs in.
export function CaseLogins({ testCase: c }: { testCase: PlanCase }) {
  if (!c.roles?.length) return null;
  return (
    <span
      className="badge badge-neutral small"
      title={`Logs in with the saved ${c.roles.join(', ')} session`}
    >
      Login: {c.roles.join(', ')}
    </span>
  );
}
