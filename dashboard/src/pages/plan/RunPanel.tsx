import type { Dispatch, SetStateAction } from 'react';
import type { Plan } from '../../api/types';
import { Command } from '../../components/Command';
import { PlanRunButton } from '../../components/PlanRunButton';
import { useEnv } from '../../hooks/useEnv';
import { plural } from '../../lib/format';
import { offProdReason } from '../../lib/prod';
import { toggled } from '../../lib/sets';
import { comparesSites, planCommand, runBody, type PlanChoice } from './choice';
import { CompareWith } from './CompareWith';

interface Props {
  plan: Plan;
  site: string;
  choice: PlanChoice;
  setChoice: Dispatch<SetStateAction<PlanChoice>>;
  activeRun: string | null;
}

// Projects, "show the browser", the command, and the Run button.
export function RunPanel({ plan, choice, setChoice, activeRun }: Props) {
  const { currentEnv } = useEnv();
  const n = choice.cases.size;
  const blocked = currentEnv.production
    ? offProdReason(plan, [...choice.cases])
    : null;
  const noProd = plan.noProdCases;
  const promptCases = new Set(plan.promptCases ?? []);
  // Only prompt cases picked: no Playwright run, so no project is needed.
  const promptsOnly =
    n > 0 && [...choice.cases].every((id) => promptCases.has(id));

  return (
    <section className="card" aria-labelledby="run-heading">
      <h2 id="run-heading">Run this plan</h2>
      {plan.noProd ? (
        <p className={currentEnv.production ? 'callout callout-bad' : 'note'}>
          Not on Production
          {plan.noProdReason ? `: ${plan.noProdReason}` : ''}.
          {currentEnv.production && ' Pick another environment in the header.'}
        </p>
      ) : (
        noProd.length > 0 &&
        (currentEnv.production ? (
          <p className="callout callout-warn">
            {noProd.join(', ')} {noProd.length > 1 ? 'are' : 'is'} no-prod, so{' '}
            {noProd.length > 1 ? 'they are' : 'it is'} left out on{' '}
            {currentEnv.name}.
          </p>
        ) : (
          <p className="note">
            Not on Production: {noProd.join(', ')}. A run there leaves{' '}
            {noProd.length > 1 ? 'them' : 'it'} out.
          </p>
        ))
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
      {comparesSites(plan) && (
        <CompareWith
          value={choice.compare}
          onChange={(compare) => setChoice((c) => ({ ...c, compare }))}
        />
      )}
      {promptCases.size > 0 && (
        <p className="note">
          Prompt cases ({[...promptCases].join(', ')}) are checked by Claude
          after the tests, and cost Claude usage.
        </p>
      )}
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
          disabled={
            Boolean(activeRun) ||
            Boolean(blocked) ||
            (choice.projects.size === 0 && !promptsOnly)
          }
          title={blocked ?? undefined}
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
