import { useState } from 'react';
import type { Finding, Run, SuiteStep } from '../api/types';
import { duration, elapsed, plural, testProgress } from '../lib/format';
import { runFile } from '../lib/runs';
import { STEP_KIND, STEP_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { ErrorBox } from './Callouts';
import { Command } from './Command';
import { TestResults } from './TestResults';

// Steps in these states start open.
const NEEDS_A_LOOK = ['failed', 'error', 'unsure'];

// The steps of a suite run, each a collapsible section with its status and
// results. A step the user opened or closed stays that way while the run
// updates; the others open by themselves once they need a look.
export function SuiteSteps({ run }: { run: Run }) {
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  return (
    <div className="steps">
      {run.steps!.map((step) => (
        <details
          key={step.n}
          className="step"
          open={toggled[step.n] ?? NEEDS_A_LOOK.includes(step.status)}
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
      {step.kind === 'prompt' && <PromptStep step={step} />}
    </>
  );
}

// A test plan step: its command and Playwright results.
function PlanStep({ run, step }: { run: Run; step: SuiteStep }) {
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
        step.status === 'running' && (
          <p className="note">
            {step.tests
              ? `Running: ${testProgress(step.tests, true)}.`
              : 'Running.'}{' '}
            See the Output panel.
          </p>
        )
      )}
    </>
  );
}

// A Claude check: the prompt, then Claude's summary, findings and
// screenshots.
function PromptStep({ step }: { step: SuiteStep }) {
  return (
    <>
      <p className="note">
        {step.role ? `As ${step.role}` : 'As an anonymous visitor'}
        {step.file ? ` (${step.file})` : ''}:
      </p>
      <pre className="prompt-text">{step.prompt}</pre>
      {step.status === 'running' && (
        <p className="note">
          Claude is checking the site. Its actions show in the Output panel.
        </p>
      )}
      {step.summary && (
        <p>
          <strong>{step.summary}</strong>
        </p>
      )}
      {!!step.findings?.length && (
        <ul className="findings">
          {step.findings.map((f, i) => (
            <FindingItem key={i} finding={f} />
          ))}
        </ul>
      )}
      {!!step.screenshots?.length && (
        <div className="shots">
          {step.screenshots.map((path) => (
            <Thumbnail key={path} path={path} />
          ))}
        </div>
      )}
      {step.turns != null && (
        <p className="note small">
          {plural(step.turns, 'turn')}
          {step.costUsd != null ? ` · $${step.costUsd.toFixed(2)}` : ''}
        </p>
      )}
    </>
  );
}

function FindingItem({ finding: f }: { finding: Finding }) {
  return (
    <li>
      {f.severity === 'problem' ? (
        <span className="badge badge-bad small">Problem</span>
      ) : (
        <span className="badge badge-neutral small">Note</span>
      )}{' '}
      {f.text}
      {f.screenshot && <span className="note small"> ({f.screenshot})</span>}
    </li>
  );
}

function Thumbnail({ path }: { path: string }) {
  const name = path.split('/').at(-1);
  return (
    <a href={runFile(path)} target="_blank" rel="noopener">
      <img src={runFile(path)} alt={`Screenshot ${name}`} loading="lazy" />
      {name}
    </a>
  );
}
