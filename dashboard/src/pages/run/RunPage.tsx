import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { Run } from '../../api/types';
import { ErrorBox, Loading } from '../../components/Callouts';
import { BackLink } from '../../components/PageTitle';
import { PromptCases } from '../../components/PromptCases';
import { RunSummary } from '../../components/RunSummary';
import { SuiteSteps } from '../../components/SuiteSteps';
import { TestProgressBar } from '../../components/TestProgressBar';
import { TestResults } from '../../components/TestResults';
import { CasePanelContext, type ShownCase } from '../../hooks/useCasePanel';
import { useEnv } from '../../hooks/useEnv';
import { RerunProvider } from '../../hooks/useRerun';
import { runOwnerPath } from '../../lib/runs';
import { CasePanel } from './CasePanel';
import { RunHead } from './RunHead';
import { useRunPolling } from './useRunPolling';

// #/runs/<id> — one run: its facts and results on the left, its output on
// the right, updated while it runs. A test's "Explain" button shows its plan
// case at the top of the right column, above the output (CasePanel).
export function RunPage() {
  const { id = '' } = useParams();
  const { run, log, error } = useRunPolling(id);
  const { currentEnv } = useEnv();
  const [shown, setShown] = useState<ShownCase | null>(null);
  const closePanel = useCallback(() => setShown(null), []);

  if (error)
    return (
      <>
        <BackLink to="/suites">← Suites</BackLink>
        <ErrorBox>{error.message}</ErrorBox>
      </>
    );
  if (!run) return <Loading />;

  return (
    <RerunProvider
      envId={currentEnv.id}
      runStatus={run.status}
      suite={run.suite}
    >
      <CasePanelContext.Provider value={{ shown, show: setShown }}>
        <div className="split">
          <div className="split-main">
            <BackLink to={runOwnerPath(run)}>
              ← {run.suite ? run.planName : 'Suites'}
            </BackLink>
            <div>
              <RunHead run={run} />
            </div>
            <div>
              <RunResults run={run} />
            </div>
          </div>
          <div className={shown ? 'run-side run-side-case' : 'run-side'}>
            {shown && (
              <CasePanel
                key={`${shown.planSlug}:${shown.caseId}`}
                shown={shown}
                onClose={closePanel}
              />
            )}
            <section
              className="output-panel"
              aria-labelledby="run-output-heading"
            >
              <h2 id="run-output-heading" className="section-title">
                Output
              </h2>
              <Log text={log} />
            </section>
          </div>
        </div>
      </CasePanelContext.Provider>
    </RerunProvider>
  );
}

function RunResults({ run }: { run: Run }) {
  if (run.kind === 'suite')
    return (
      <>
        {run.status !== 'running' &&
          run.steps?.some((s) => s.kind === 'plan' && s.stats) && (
            <RunSummary runId={run.id} />
          )}
        <SuiteSteps run={run} />
      </>
    );
  return (
    <>
      <RunTests run={run} />
      {!!run.prompts?.length && <PromptCases prompts={run.prompts} />}
    </>
  );
}

// A plan run's Playwright results (none when only prompt cases ran).
function RunTests({ run }: { run: Run }) {
  if (run.command === null) return null;
  if (run.stats)
    return (
      <>
        {run.status !== 'running' && <RunSummary runId={run.id} />}
        <TestResults
          runId={run.id}
          planSlug={run.plan}
          stats={run.stats}
          results={run.results}
          errors={run.errors}
        />
      </>
    );
  if (run.status === 'running') return <TestProgressBar tests={run.tests} />;
  if (run.status === 'error')
    return (
      <ErrorBox>
        Playwright stopped before running any test. See the output.
      </ErrorBox>
    );
  return null;
}

// The run's output. Follows the end as it grows, unless the user has
// scrolled up to read.
function Log({ text }: { text: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const follow = useRef(true);

  useLayoutEffect(() => {
    if (follow.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  return (
    <pre
      ref={ref}
      className="log"
      tabIndex={0}
      aria-label="Test output"
      onScroll={(e) => {
        const el = e.currentTarget;
        follow.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
      }}
    >
      {text}
    </pre>
  );
}
