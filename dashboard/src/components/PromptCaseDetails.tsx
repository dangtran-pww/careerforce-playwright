import type { ReactNode } from 'react';
import type { PlanCase } from '../api/types';
import { useEnv } from '../hooks/useEnv';
import { inline } from '../lib/inline';
import { splitNumbered } from '../lib/numbered';
import { comparedWith, screenshotLimit } from '../pages/suite/planChoice';
import { Command } from './Command';
import { PromptBody } from './PromptBody';
import { StepList } from './StepList';

// A prompt case opened in a cases table or the case panel. It has no test
// code, and its plan row is only a link to its prompt file, so it shows what
// the file says: what Claude checks and how it's set up, the prompt itself,
// and what passes (test-suites/README.md, Rule 2).
export function PromptCaseDetails({
  testCase,
  command,
}: {
  testCase: PlanCase;
  command?: string;
}) {
  const p = testCase.prompt;
  const problems = testCase.promptProblems ?? [];
  // Any other column the plan has (Notes, say); the Prompt link is the
  // prompt file, shown in the facts.
  const shown = ['prompt', 'prod'];
  const others = testCase.details.filter(
    (d) => !shown.includes(d.label.toLowerCase()),
  );

  return (
    <div className="case-details prompt-case-details">
      {problems.length > 0 && (
        <p className="callout callout-bad">Can't run: {problems.join(' ')}</p>
      )}
      <dl>
        <div>
          <dt>What Claude checks</dt>
          <dd>
            {p && <p className="prompt-case-lead">{p.name}</p>}
            <PromptFacts testCase={testCase} />
          </dd>
        </div>
        {p && (
          <div>
            <dt>Prompt sent to Claude</dt>
            <dd>
              <PromptBody text={p.prompt} />
            </dd>
          </div>
        )}
        {p?.expected && (
          <div>
            <dt>Passes when</dt>
            <dd>
              <PromptBody text={p.expected} />
            </dd>
          </div>
        )}
        {others.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{numberedOrText(d.text)}</dd>
          </div>
        ))}
        {command && (
          <div>
            <dt>Command</dt>
            <dd>
              <Command text={command} />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// The prompt file's settings, as a two-column list.
function PromptFacts({ testCase }: { testCase: PlanCase }) {
  const { currentEnv, envById } = useEnv();
  const p = testCase.prompt;
  const facts: [string, ReactNode][] = [];
  if (p) {
    facts.push(
      ['Prompt file', <code key="f">{p.file}</code>],
      ['Runs as', p.role ?? 'An anonymous visitor'],
      [
        'Compares with',
        p.compare === 'none'
          ? 'Nothing: reviews the page on its own'
          : `${comparedWith(testCase, 'default', currentEnv, envById)} (on ${currentEnv.name}${p.compare === 'default' ? ', the default' : `, set to "${p.compare}"`})`,
      ],
      [
        'Viewports',
        p.viewports.map((v) => `${v.name} ${v.width}×${v.height}`).join(', '),
      ],
      [
        'Screenshots',
        `Up to ${screenshotLimit(testCase, 'default', currentEnv)} (on ${currentEnv.name})`,
      ],
      ['Parallel', p.parallel ? 'Yes: runs alongside other work' : 'No'],
    );
  }
  if (!facts.length) return null;
  return (
    <dl className="prompt-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function numberedOrText(text: string) {
  const n = splitNumbered(text);
  return n ? <StepList numbered={n} /> : inline(text);
}
