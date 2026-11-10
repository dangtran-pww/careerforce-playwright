import type { PlanCase } from '../api/types';
import { CaseExplain } from './CaseExplain';
import { Command } from './Command';
import { inline } from '../lib/inline';
import { Tags } from './Tags';

// How a test case is performed and what it expects: the rest of its row in
// the plan (Steps, Expected result, Notes, …), as label / text pairs, then
// where its code is, the command that runs it on its own and, on request,
// Claude's account of what that code does. Returns null when there is
// nothing to show beyond the title.
export function CaseDetails({
  planSlug,
  testCase,
  command,
}: {
  planSlug: string;
  testCase: PlanCase;
  command?: string; // runs only this case; left out when it has no tests
}) {
  const details = testCase.details ?? [];
  const locations = testCase.locations ?? [];
  if (!details.length && !locations.length && !command) return null;
  return (
    <div className="case-details">
      <dl>
        {details.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{inline(d.text)}</dd>
          </div>
        ))}
        {locations.length > 0 && (
          <div>
            <dt>Code</dt>
            <dd>
              {locations.map((l) => (
                <div key={`${l.file}:${l.line}`} title={l.title}>
                  <code>
                    {l.file}:{l.line}
                  </code>
                  <Tags tags={l.tags} />
                </div>
              ))}
            </dd>
          </div>
        )}
        {command && (
          <div>
            <dt>Command</dt>
            <dd>
              <Command text={command} />
            </dd>
          </div>
        )}
      </dl>
      {locations.length > 0 && (
        <CaseExplain planSlug={planSlug} caseId={testCase.id} />
      )}
    </div>
  );
}
