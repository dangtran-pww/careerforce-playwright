import { useState } from 'react';
import { useParams } from 'react-router';
import type { PlanResponse } from '../../api/types';
import { Badge } from '../../components/Badge';
import { ActiveRunBanner, ErrorBox, Loading } from '../../components/Callouts';
import { EnvTag } from '../../components/EnvTag';
import { Facts } from '../../components/Facts';
import { BackLink, TitleRow } from '../../components/PageTitle';
import { RunsTable } from '../../components/RunsTable';
import { SessionCard } from '../../components/SessionCard';
import { TestCountNote } from '../../components/TestCountNote';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { PLAN_STATUS } from '../../lib/status';
import { CasesTable } from './CasesTable';
import { PromptCasesTable } from './PromptCasesTable';
import { defaultChoice } from './choice';
import { NoTestsPanel, RunPanel } from './RunPanel';

// #/plans/<slug> — one plan: pick projects and cases and run it, see the
// sessions it needs, its cases and its recent runs.
export function PlanPage() {
  const { slug } = useParams();
  const { currentEnv } = useEnv();
  const { data, error } = useApi<PlanResponse>(
    `/api/plans/${slug}?env=${currentEnv.id}`,
  );

  if (error)
    return (
      <>
        <BackLink to="/suites">← Suites</BackLink>
        <ErrorBox>{error.message}</ErrorBox>
      </>
    );
  if (!data) return <Loading />;
  return <PlanDetails {...data} />;
}

function PlanDetails({ plan, site, runs, activeRun }: PlanResponse) {
  const { currentEnv } = useEnv();
  const [choice, setChoice] = useState(() => defaultChoice(plan));
  const testCases = plan.cases.filter((c) => c.kind !== 'prompt');
  const promptCases = plan.cases.filter((c) => c.kind === 'prompt');

  return (
    <>
      <BackLink to="/suites">← Suites</BackLink>
      <TitleRow title={plan.name}>
        <span className="kind-label">{plan.type}</span>
        <Badge map={PLAN_STATUS} value={plan.status} />
      </TitleRow>
      <div className="card intro-card">
        {plan.summary && <p className="lede">{plan.summary}</p>}
        <Facts
          items={[
            ['Plan', <code>{plan.file}</code>],
            [
              'Tests',
              plan.files.length
                ? plan.files.map((f) => (
                    <div key={f}>
                      <code>{f}</code>
                    </div>
                  ))
                : '—',
            ],
            [
              'Environment',
              <>
                <EnvTag env={currentEnv} /> {site}
              </>,
            ],
          ]}
        />
      </div>
      {plan.notes.map((n) => (
        <p key={n} className="callout callout-warn">
          {n}
        </p>
      ))}
      <ActiveRunBanner runId={activeRun} />
      <div className="grid">
        {plan.runnable ? (
          <RunPanel
            plan={plan}
            site={site}
            choice={choice}
            setChoice={setChoice}
            activeRun={activeRun}
          />
        ) : (
          <NoTestsPanel />
        )}
        {plan.roles.map((role) => (
          <SessionCard key={role} role={role} />
        ))}
      </div>
      <h2 className="section-title">Cases ({testCases.length})</h2>
      {plan.hasTests && (
        <TestCountNote caseCount={testCases.length} projects={plan.projects} />
      )}
      <CasesTable
        plan={plan}
        cases={testCases}
        choice={choice}
        setChoice={setChoice}
        activeRun={activeRun}
      />
      {promptCases.length > 0 && (
        <>
          <h2 className="section-title">Prompt cases ({promptCases.length})</h2>
          <p className="note">
            Checked by Claude in a browser, from a prompt instead of test code.
            They run after the tests and cost Claude usage.
          </p>
          <PromptCasesTable
            plan={plan}
            cases={promptCases}
            choice={choice}
            setChoice={setChoice}
            activeRun={activeRun}
          />
        </>
      )}
      <h2 className="section-title">Recent runs</h2>
      <RunsTable runs={runs} showPlan={false} />
    </>
  );
}
