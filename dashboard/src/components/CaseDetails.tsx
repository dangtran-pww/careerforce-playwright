import type { CaseDetail, PlanCase } from '../api/types';
import { CaseExplain } from './CaseExplain';
import { Command } from './Command';
import { PromptCaseDetails } from './PromptCaseDetails';
import { inline } from '../lib/inline';
import { splitNumbered } from '../lib/numbered';
import { StepList } from './StepList';
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
  // A prompt case has no code: it's shown its own way.
  if (testCase.kind === 'prompt')
    return <PromptCaseDetails testCase={testCase} command={command} />;
  const locations = testCase.locations ?? [];
  const details = withSteps(testCase.details ?? []);
  if (!details.length && !locations.length && !command) return null;
  return (
    <div className="case-details">
      <dl>
        {details.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{d.body}</dd>
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

// The details ready to show, each in its own section. Numbered text (e.g.
// Steps, Expected result) becomes a list.
function withSteps(details: CaseDetail[]) {
  return details.map((d) => {
    const n = splitNumbered(d.text);
    return {
      label: d.label,
      body: n ? <StepList numbered={n} /> : inline(d.text),
    };
  });
}
