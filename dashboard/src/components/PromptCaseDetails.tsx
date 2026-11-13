import type { ReactNode } from 'react';
import type { PlanCase } from '../api/types';
import { useEnv } from '../hooks/useEnv';
import { inline } from '../lib/inline';
import { splitNumbered } from '../lib/numbered';
import { comparedWith, screenshotLimit } from '../pages/suite/planChoice';
import { Command } from './Command';
import { StepList } from './StepList';

// A prompt case opened in a cases table or the case panel. It has no test
// code, so instead of the plan row's Steps and Expected result as they are
// written, it shows what Claude does and how it's set up, what passes, and
// the prompt itself (test-suites/README.md, Rule 2).
export function PromptCaseDetails({
  testCase,
  command,
}: {
  testCase: PlanCase;
  command?: string;
}) {
  const p = testCase.prompt;
  const problems = testCase.promptProblems ?? [];
  const detail = (label: string) =>
    testCase.details.find((d) => d.label.toLowerCase() === label)?.text;
  const lead = leadOf(detail('steps') ?? '');
  const passes = detail('expected result');
  // Any other column the plan has (Notes, say); Page goes in the facts, and
  // Steps and Expected result have their own places.
  const shown = ['page', 'steps', 'expected result', 'required login'];
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
            {lead && <p className="prompt-case-lead">{inline(lead)}</p>}
            <PromptFacts testCase={testCase} page={detail('page')} />
          </dd>
        </div>
        {passes && (
          <div>
            <dt>Passes when</dt>
            <dd>{numberedOrText(passes)}</dd>
          </div>
        )}
        {others.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd>{numberedOrText(d.text)}</dd>
          </div>
        ))}
        {p && (
          <div>
            <dt>Prompt sent to Claude</dt>
            <dd>
              <PromptBody text={p.prompt} />
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
    </div>
  );
}

// The prompt file's settings, as a two-column list.
function PromptFacts({
  testCase,
  page,
}: {
  testCase: PlanCase;
  page?: string;
}) {
  const { currentEnv, envById } = useEnv();
  const p = testCase.prompt;
  const facts: [string, ReactNode][] = [];
  if (page) facts.push(['Page', inline(page)]);
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

// The prompt's Markdown, simply: paragraphs and "- " lists, with inline
// `code` and **bold**.
function PromptBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="prompt-body">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (!lines[0].trimStart().startsWith('- '))
          return <p key={i}>{inline(lines.join(' ').trim())}</p>;
        // A list item runs on until the next "- ".
        const items: string[] = [];
        for (const line of lines) {
          if (line.trimStart().startsWith('- '))
            items.push(line.trimStart().slice(2));
          else items[items.length - 1] += ` ${line.trim()}`;
        }
        return (
          <ul key={i}>
            {items.map((item, j) => (
              <li key={j}>{inline(item.trim())}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

// "**Prompt:** homepage-compare: Claude compares …" → "Claude compares …".
const leadOf = (steps: string) =>
  steps.replace(/^\s*\*\*Prompt:\*\*\s*[\w.-]+\s*:?\s*/i, '').trim();

function numberedOrText(text: string) {
  const n = splitNumbered(text);
  return n ? <StepList numbered={n} /> : inline(text);
}
