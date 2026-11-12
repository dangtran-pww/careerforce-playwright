import { useState } from 'react';
import type { Run, SuiteStep } from '../api/types';
import { duration, elapsed } from '../lib/format';
import { runFile } from '../lib/runs';
import { STEP_KIND, STEP_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { ErrorBox } from './Callouts';
import { Command } from './Command';
import { PromptCases } from './PromptCases';
import { PromptResult } from './PromptResult';
import { TestProgressBar } from './TestProgressBar';
import { TestResults } from './TestResults';

// Steps in these states start open.
const NEEDS_A_LOOK = ['failed', 'error', 'unsure'];

// The steps of a suite run, each a collapsible section with its status and
// results. A step the user opened or closed stays that way while the run
// updates; the others open by themselves while they are the first one
// running, or once they need a look.
export function SuiteSteps({ run }: { run: Run }) {
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const firstRunning = run.steps!.find((s) => s.status === 'running')?.n;

  return (
    <div className="steps">
      {run.steps!.map((step) => (
        <details
          key={step.n}
          className="step"
          open={
            toggled[step.n] ??
            (step.n === firstRunning || NEEDS_A_LOOK.includes(step.status))
          }
          onToggle={(e) => {
            const open = e.currentTarget.open;
            setToggled((t) =>
              t[step.n] === open ? t : { ...t, [step.n]: open },
            );
          }}
        >
          <summary>
            <span className="step-title">
              {step.n}. {step.title}
            </span>
            <span className="step-kind">{STEP_KIND[step.kind]}</span>
            {step.startedAt && (
              <span className="note small">
                {duration(elapsed(step.startedAt, step.finishedAt))}
              </span>
            )}
            <Badge map={STEP_STATUS} value={step.status} />
          </summary>
          <div className="step-body">
            <StepBody run={run} step={step} />
          </div>
        </details>
      ))}
    </div>
  );
}

function StepBody({ run, step }: { run: Run; step: SuiteStep }) {
  if (step.status === 'pending')
    return <p className="note">Runs after the steps above.</p>;
  if (step.status === 'skipped')
    return <p className="note">{step.skipReason ?? 'Skipped.'}</p>;
  return (
    <>
      {step.error && <ErrorBox>{step.error}</ErrorBox>}
      {step.kind === 'plan' && <PlanStep run={run} step={step} />}
      {step.kind === 'prompt' && <PromptResult result={step} />}
    </>
  );
}

// A test plan step: its command and Playwright results, then its prompt
// cases.
function PlanStep({ run, step }: { run: Run; step: SuiteStep }) {
  return (
    <>
      <PlanTests run={run} step={step} />
      {!!step.prompts?.length && <PromptCases prompts={step.prompts} />}
    </>
  );
}

function PlanTests({ run, step }: { run: Run; step: SuiteStep }) {
  if (!step.command && step.prompts?.length) return null; // prompt cases only
  return (
    <>
      {step.command && <Command text={step.command} />}
      {step.stats ? (
        <>
          <TestResults
            runId={run.id}
            step={step.n}
            planSlug={step.plan}
            stats={step.stats}
            results={step.results}
            errors={step.errors}
          />
          <div className="actions">
            <a
              className="button"
              href={runFile(`${run.id}/${step.dir}/report/`)}
              target="_blank"
              rel="noopener"
            >
              Open Playwright report
            </a>
          </div>
        </>
      ) : (
        step.status === 'running' && <TestProgressBar tests={step.tests} />
      )}
    </>
  );
}
