import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import type { SuiteResponse } from '../../api/types';
import { AsyncButton } from '../../components/AsyncButton';
import { ActiveRunBanner, ErrorBox, Loading } from '../../components/Callouts';
import { EnvTag } from '../../components/EnvTag';
import { Facts } from '../../components/Facts';
import { LoginsNote } from '../../components/LoginsNote';
import { BackLink, TitleRow } from '../../components/PageTitle';
import { RunsTable } from '../../components/RunsTable';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useNeededLogins } from '../../hooks/useLogins';
import { useStartRun } from '../../hooks/useStartRun';
import { plural } from '../../lib/format';
import { toggled } from '../../lib/sets';
import {
  defaultSuiteChoice,
  neededRoles,
  type SuiteChoice,
} from './suiteChoice';
import { PlanPanel } from './PlanPanel';
import { RunRefused, useRunRefusal } from './RunRefused';
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
  const [choice, setChoice] = useState(() => defaultSuiteChoice(suite));
  // Why the last Run press didn't start a run; cleared on the next press.
  const { refusal, onError, clear: clearRefusal } = useRunRefusal();
  const start = useStartRun(onError);
  // The plan whose details show in the right-hand column; none leaves it
  // empty (the column is always there, so the page never changes width).
  // ?plan=<slug> opens it (a plan run's page links back that way), and
  // &case=<id> opens that case's row (the header's case search links that
  // way). The page stays mounted when only the query changes, so a new
  // search on this page opens its plan and case here.
  const [params] = useSearchParams();
  const planParam = params.get('plan');
  const openCase = params.get('case');
  const linkedPlan = suite.plans.some((x) => x.slug === planParam)
    ? planParam
    : null;
  const [shownPlan, setShownPlan] = useState<string | null>(linkedPlan);
  const [linked, setLinked] = useState({ plan: planParam, case: openCase });
  if (linked.plan !== planParam || linked.case !== openCase) {
    setLinked({ plan: planParam, case: openCase });
    if (linkedPlan) setShownPlan(linkedPlan);
  }
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
  const loginRoles = neededRoles(suite, choice);
  useNeededLogins(loginRoles);

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
          <label className="check">
            <input
              type="checkbox"
              checked={choice.a11y}
              onChange={(e) =>
                setChoice((c) => ({ ...c, a11y: e.target.checked }))
              }
            />
            <span>Scan pages for accessibility</span>
          </label>
          {choice.a11y && (
            <p className="note small">
              Every page and dialog the tests and prompt cases reach is checked
              with axe (WCAG 2.2 A/AA), each one once per run. A broken rule
              fails the run; the results are on the run page.
            </p>
          )}
          <p className="note small">
            Plans run one after another, each with its prompt cases after its
            tests. Stop ends the current plan and skips the rest. Each prompt
            case runs Claude Code (claude -p) and uses your Claude plan or API
            credits.
          </p>
          <LoginsNote
            roles={loginRoles}
            none="The chosen plans need no login."
          />
          {refusal && <RunRefused refusal={refusal} />}
          <div className="actions">
            <AsyncButton
              disabled={Boolean(activeRun) || blocked || total === 0}
              busyLabel={loginRoles.length ? 'Checking logins…' : 'Starting…'}
              onClick={() => {
                clearRefusal();
                return start(`/api/suites/${suite.slug}/run`, {
                  plans: [...choice.plans],
                  headed: choice.headed,
                  a11y: choice.a11y,
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
          // A new case link remounts it, so that case opens and scrolls into
          // view.
          key={
            shownPlan === linkedPlan ? `${shownPlan}:${openCase}` : shownPlan
          }
          slug={shownPlan}
          openCase={shownPlan === linkedPlan ? openCase : null}
          suite={suite.slug}
          onClose={closePanel}
          projects={
            suite.plans.find((p) => p.slug === shownPlan)?.projects ?? []
          }
          headed={choice.headed}
          a11y={choice.a11y}
          activeRun={activeRun}
        />
      ) : (
        <div className="split-empty" aria-hidden="true" />
      )}
    </div>
  );
}
