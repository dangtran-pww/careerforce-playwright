import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import type { SuiteResponse } from '../../api/types';
import { ActiveRunBanner, ErrorBox, Loading } from '../../components/Callouts';
import { Facts } from '../../components/Facts';
import { BackLink, TitleRow } from '../../components/PageTitle';
import { RunsTable } from '../../components/RunsTable';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useNeededLogins } from '../../hooks/useLogins';
import { PlanList } from './PlanList';
import { PlanPanel } from './PlanPanel';

// #/suites/<slug> — one suite: its plans, each opened and run in the side
// panel. The logins the opened plan needs show in the header's Login
// Sessions panel.
export function SuitePage() {
  const { slug } = useParams();
  const { currentEnv } = useEnv();
  // Asks again when the header's environment changes: the run in progress
  // (activeRun) is the one on that environment.
  const { data, error } = useApi<SuiteResponse>(
    `/api/suites/${slug}?env=${currentEnv.id}`,
  );

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

  const shown = suite.plans.find((p) => p.slug === shownPlan);
  useNeededLogins(shown?.roles ?? []);

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
        <section className="card" aria-labelledby="suite-plans-heading">
          <div className="card-head">
            <h2 id="suite-plans-heading">Test plans</h2>
          </div>
          <PlanList
            suite={suite}
            shownPlan={shownPlan}
            onShowPlan={setShownPlan}
          />
          <p className="note small">
            Open a plan&apos;s details to run it, its test cases or prompt
            cases, or a single case.
          </p>
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
          projects={shown?.projects ?? []}
          activeRun={activeRun}
        />
      ) : (
        <div className="split-empty" aria-hidden="true" />
      )}
    </div>
  );
}
