import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../../api/client';
import type { Session, SuiteResponse } from '../../api/types';
import { AsyncButton } from '../../components/AsyncButton';
import { ActiveRunBanner, ErrorBox, Loading } from '../../components/Callouts';
import { EnvTag } from '../../components/EnvTag';
import { Facts } from '../../components/Facts';
import { BackLink, TitleRow } from '../../components/PageTitle';
import { RunsTable } from '../../components/RunsTable';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useLoginsPanel, useNeededLogins } from '../../hooks/useLogins';
import { useStartRun } from '../../hooks/useStartRun';
import { plural } from '../../lib/format';
import { toggled } from '../../lib/sets';
import { defaultChoice, neededLogins, type SuiteChoice } from './choice';
import { PlanPanel } from './PlanPanel';
import { RunRefused, type Refusal } from './RunRefused';
import { PlanChecklist, PromptChecklist } from './StepChecklists';

// #/suites/<slug> — one suite: pick its steps and run it. The logins the
// chosen steps need show in the header's Login Sessions panel.
export function SuitePage() {
  const { slug } = useParams();
  const { data, error } = useApi<SuiteResponse>(`/api/suites/${slug}`);

  if (error)
    return (
      <>
        <BackLink to="/suites">← Suites</BackLink>
        <ErrorBox>{error.message}</ErrorBox>
      </>
    );
  if (!data) return <Loading />;
  return <SuiteDetails {...data} />;
}

function SuiteDetails({ suite, runs, activeRun }: SuiteResponse) {
  const { currentEnv: env } = useEnv();
  const [choice, setChoice] = useState(() => defaultChoice(suite));
  // Why the last Run press didn't start a run; cleared on the next press.
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { openPanel, recheck } = useLoginsPanel();
  const start = useStartRun((err) => {
    const logins =
      err instanceof ApiError && Array.isArray(err.data.logins)
        ? (err.data.logins as Session[])
        : [];
    setRefusal({ message: err.message, logins });
    // Show the logins that stopped it, checked again.
    if (logins.length) {
      recheck();
      openPanel();
    }
  });
  // The plan whose details show in the right-hand panel; none hides it.
  const [shownPlan, setShownPlan] = useState<string | null>(null);
  const closePanel = useCallback(() => setShownPlan(null), []);

  // Tick or untick one step in one of the two lists.
  const toggle = (list: 'plans' | 'prompts') => (key: string, on: boolean) =>
    setChoice((c: SuiteChoice) => ({
      ...c,
      [list]: toggled(c[list], key, on),
    }));

  const total = choice.plans.size + choice.prompts.size;
  const blocked = suite.changesData && env.production;
  const logins = neededLogins(suite, choice, env);
  useNeededLogins(logins.map((l) => l.role));

  return (
    <div className={shownPlan ? 'split split-open' : 'split'}>
      <div className="split-main">
        <BackLink to="/suites">← Suites</BackLink>
        <TitleRow title={suite.name}>
          <span className="kind-label">Suite</span>
        </TitleRow>
        {suite.summary && <p className="lede">{suite.summary}</p>}
        <Facts plain items={[['Suite file', <code>{suite.file}</code>]]} />
        {suite.problems.map((p) => (
          <p key={p} className="callout callout-warn">
            {p}
          </p>
        ))}
        <ActiveRunBanner runId={activeRun} />
        <section className="card" aria-labelledby="suite-run-heading">
          <div className="card-head">
            <h2 id="suite-run-heading">
              Run on <EnvTag env={env} />
            </h2>
          </div>
          {blocked && (
            <p className="callout callout-bad">
              This suite has plans that change data, so it never runs on
              Production. Pick another environment in the header.
            </p>
          )}
          <PlanChecklist
            suite={suite}
            selected={choice.plans}
            onToggle={toggle('plans')}
            shownPlan={shownPlan}
            onShowPlan={setShownPlan}
          />
          <PromptChecklist
            suite={suite}
            selected={choice.prompts}
            onToggle={toggle('prompts')}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={choice.headed}
              onChange={(e) =>
                setChoice((c) => ({ ...c, headed: e.target.checked }))
              }
            />
            <span>Show the browser while the tests run</span>
          </label>
          <p className="note small">
            Steps run one after another: plans, then prompts. Stop ends the
            current step and skips the rest. Each prompt runs Claude Code
            (claude -p) and uses your Claude plan or API credits.
          </p>
          <p className="note small">
            {logins.length
              ? `Logs in as ${logins.map((l) => l.role).join(', ')}. `
              : 'The chosen steps need no login. '}
            {logins.length > 0 && (
              <button type="button" className="link" onClick={openPanel}>
                Check the login sessions
              </button>
            )}
          </p>
          {refusal && <RunRefused refusal={refusal} />}
          <div className="actions">
            <AsyncButton
              disabled={Boolean(activeRun) || blocked || total === 0}
              busyLabel={logins.length ? 'Checking logins…' : 'Starting…'}
              onClick={() => {
                setRefusal(null);
                return start(`/api/suites/${suite.slug}/run`, {
                  plans: [...choice.plans],
                  prompts: [...choice.prompts],
                  headed: choice.headed,
                });
              }}
            >
              {activeRun
                ? 'Another run is in progress'
                : blocked
                  ? 'Not on Production'
                  : `Run ${plural(total, 'step')} on ${env.name}`}
            </AsyncButton>
          </div>
        </section>
        <h2 className="section-title">Recent runs</h2>
        <RunsTable runs={runs} showPlan={false} />
      </div>
      {shownPlan && (
        <PlanPanel
          key={shownPlan}
          slug={shownPlan}
          onClose={closePanel}
          projects={
            suite.plans.find((p) => p.slug === shownPlan)?.projects ?? []
          }
          headed={choice.headed}
          activeRun={activeRun}
        />
      )}
    </div>
  );
}
