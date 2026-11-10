import type { Dispatch, SetStateAction } from 'react';
import type { Plan } from '../../api/types';
import { Command } from '../../components/Command';
import { PlanRunButton } from '../../components/PlanRunButton';
import { useEnv } from '../../hooks/useEnv';
import { hostOf, plural } from '../../lib/format';
import { toggled } from '../../lib/sets';
import { planCommand, runBody, type PlanChoice } from './choice';

interface Props {
  plan: Plan;
  site: string;
  choice: PlanChoice;
  setChoice: Dispatch<SetStateAction<PlanChoice>>;
  activeRun: string | null;
}

// Projects, "show the browser", the command, and the Run button.
export function RunPanel({ plan, site, choice, setChoice, activeRun }: Props) {
  const { currentEnv } = useEnv();
  const n = choice.cases.size;
  const blocked = plan.changesData && currentEnv.production;

  return (
    <section className="card" aria-labelledby="run-heading">
      <h2 id="run-heading">Run this plan</h2>
      {plan.changesData && (
        <p className="callout callout-warn">
          These tests create, edit or delete content on {currentEnv.name} (
          {hostOf(site)}). Run them on QA or Stage only, never production.
        </p>
      )}
      <fieldset>
        <legend>Projects</legend>
        {plan.projects.map((p) => (
          <label key={p.name} className="check">
            <input
              type="checkbox"
              checked={choice.projects.has(p.name)}
              onChange={(e) =>
                setChoice((c) => ({
                  ...c,
                  projects: toggled(c.projects, p.name, e.target.checked),
                }))
              }
            />
            <span>
              <strong>{p.name}</strong> — {plural(p.testCount, 'test')}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          checked={choice.headed}
          onChange={(e) =>
            setChoice((c) => ({ ...c, headed: e.target.checked }))
          }
        />
        <span>Show the browser while it runs</span>
      </label>
      <p className="note">
        {n ? (
          <>
            {plural(n, 'case')} selected: {[...choice.cases].join(', ')}.{' '}
            <button
              type="button"
              className="link"
              onClick={() => setChoice((c) => ({ ...c, cases: new Set() }))}
            >
              Run all cases instead
            </button>
          </>
        ) : (
          `All ${plural(plan.cases.length, 'case')}. Tick cases below to run only those.`
        )}
      </p>
      <Command text={planCommand(plan, choice, currentEnv)} />
      <div className="actions">
        <PlanRunButton
          plan={plan}
          body={runBody(choice)}
          disabled={Boolean(activeRun) || blocked || choice.projects.size === 0}
        >
          {activeRun
            ? 'Another run is in progress'
            : blocked
              ? 'Not on Production'
              : n
                ? `Run ${plural(n, 'case')} on ${currentEnv.name}`
                : `Run plan on ${currentEnv.name}`}
        </PlanRunButton>
      </div>
    </section>
  );
}

export function NoTestsPanel() {
  return (
    <section className="card">
      <h2>Run this plan</h2>
      <p className="message">
        There are no tests for this plan yet, so there is nothing to run.
        Generate them first (see test-plans/README.md).
      </p>
    </section>
  );
}
