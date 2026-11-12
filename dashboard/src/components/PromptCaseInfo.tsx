import type { PlanCase } from '../api/types';

// What a prompt case runs: its prompt file, what it compares with, its
// viewports and the prompt itself, or what's wrong with the file.
export function PromptCaseInfo({ testCase }: { testCase: PlanCase }) {
  const p = testCase.prompt;
  const problems = testCase.promptProblems ?? [];
  return (
    <div>
      <dt>Prompt</dt>
      <dd>
        {problems.length > 0 && (
          <p className="callout callout-bad">Can't run: {problems.join(' ')}</p>
        )}
        {p && (
          <>
            <p className="note">
              <code>{p.file}</code> · {p.role ? `as ${p.role}` : 'anonymous'} ·{' '}
              {p.viewports
                .map((v) => `${v.name} ${v.width}×${v.height}`)
                .join(', ')}{' '}
              · {compareLabel(p.compare)}
            </p>
            <pre className="prompt-text">{p.prompt}</pre>
          </>
        )}
      </dd>
    </div>
  );
}

function compareLabel(compare: string) {
  if (compare === 'none') return 'no comparison';
  if (compare === 'default')
    return "compares with the environment's comparison site";
  if (compare === 'baseline') return 'compares with its last run (baseline)';
  return `compares with ${compare}`;
}
