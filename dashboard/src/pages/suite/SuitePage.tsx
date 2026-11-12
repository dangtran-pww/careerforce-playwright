import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
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
import { PlanChecklist } from './StepChecklists';

// #/suites/<slug> — one suite: pick its plans and run it. The logins the
// chosen plans need show in the header's Login Sessions panel.
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
  // The plan whose details show in the right-hand column; none leaves it
  // empty (the column is always there, so the page never changes width).
  // ?plan=<slug> opens it (a plan run's page links back that way).
  const [params] = useSearchParams();
  const [shownPlan, setShownPlan] = useState<string | null>(() => {
    const p = params.get('plan');
    return suite.plans.some((x) => x.slug === p) ? p : null;
  });
  const closePanel = useCallback(() => setShownPlan(null), []);

  // Tick or untick one plan.
  const toggle = (key: string, on: boolean) =>
    setChoice((c: SuiteChoice) => ({
      ...c,
      plans: toggled(c.plans, key, on),
    }));

  const total = choice.plans.size;
  // On production the chosen plans run without their no-prod cases; a plan
  // whose cases are all no-prod is skipped.
  const chosenPlans = suite.plans.filter((p) => choice.plans.has(p.slug));
  const offProd = env.production
    ? chosenPlans.filter((p) => (p.noProdCases?.length ?? 0) > 0)
    : [];
  const blocked =
    env.production &&
    chosenPlans.length > 0 &&
    chosenPlans.every((p) => p.allNoProd);
  const logins = neededLogins(suite, choice, env);
  useNeededLogins(logins.map((l) => l.role));

  return (
    <div className="split">
      <div className="split-main">
        <BackLink to="/suites">← Suites</BackLink>
        <TitleRow title={suite.name}>
          <span className="kind-label">Suite</span>
        </TitleRow>
        <div className="card intro-card">
          {suite.summary && <p className="lede">{suite.summary}</p>}
          <Facts items={[['Suite file', <code>{suite.file}</code>]]} />
        </div>
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
          {blocked ? (
            <p className="callout callout-bad">
              Every case of the chosen plans is no-prod, so nothing would run on
              Production. Pick another environment in the header.
            </p>
          ) : (
            offProd.length > 0 && (
              <p className="callout callout-warn">
                On Production, the no-prod cases are left out:{' '}
                {offProd
                  .map((p) =>
                    p.allNoProd
                      ? `${p.name} (skipped)`
                      : `${p.noProdCases?.join(', ')}`,
                  )
                  .join('; ')}
                .
              </p>
            )
          )}
          <PlanChecklist
            suite={suite}
            selected={choice.plans}
            onToggle={toggle}
            shownPlan={shownPlan}
            onShowPlan={setShownPlan}
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
            Plans run one after another, each with its prompt cases after its
            tests. Stop ends the current plan and skips the rest. Each prompt
            case runs Claude Code (claude -p) and uses your Claude plan or API
            credits.
          </p>
          <p className="note small">
            {logins.length
              ? `Logs in as ${logins.map((l) => l.role).join(', ')}. `
              : 'The chosen plans need no login. '}
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
                  headed: choice.headed,
                });
              }}
            >
              {activeRun
                ? 'Another run is in progress'
                : blocked
                  ? 'Not on Production'
                  : `Run ${plural(total, 'plan')} on ${env.name}`}
            </AsyncButton>
          </div>
        </section>
        <h2 className="section-title">Recent runs</h2>
        {/* The suite's runs and the plan runs started from its plan panel. */}
        <RunsTable runs={runs} />
      </div>
      {shownPlan ? (
        <PlanPanel
          key={shownPlan}
          slug={shownPlan}
          suite={suite.slug}
          onClose={closePanel}
          projects={
            suite.plans.find((p) => p.slug === shownPlan)?.projects ?? []
          }
          headed={choice.headed}
          activeRun={activeRun}
        />
      ) : (
        <div className="split-empty" aria-hidden="true" />
      )}
    </div>
  );
}
