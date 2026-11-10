import { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router';
import type { Run } from '../../api/types';
import { ErrorBox, Loading } from '../../components/Callouts';
import { BackLink } from '../../components/PageTitle';
import { SuiteSteps } from '../../components/SuiteSteps';
import { TestResults } from '../../components/TestResults';
import { runOwnerPath } from '../../lib/runs';
import { RunHead } from './RunHead';
import { useRunPolling } from './useRunPolling';

// #/runs/<id> — one run: its facts, its results, and its output, updated
// while it runs.
export function RunPage() {
  const { id = '' } = useParams();
  const { run, log, error } = useRunPolling(id);

  if (error)
    return (
      <>
        <BackLink to="/runs">← Runs</BackLink>
        <ErrorBox>{error.message}</ErrorBox>
      </>
    );
  if (!run) return <Loading />;

  return (
    <>
      <BackLink to={runOwnerPath(run)}>← {run.planName}</BackLink>
      <div>
        <RunHead run={run} />
      </div>
      <div>
        <RunResults run={run} />
      </div>
      <details className="output" open>
        <summary>Output</summary>
        <Log text={log} />
      </details>
    </>
  );
}

function RunResults({ run }: { run: Run }) {
  if (run.kind === 'suite') return <SuiteSteps run={run} />;
  if (run.stats)
    return (
      <TestResults
        stats={run.stats}
        results={run.results}
        errors={run.errors}
      />
    );
  if (run.status === 'error')
    return (
      <ErrorBox>
        Playwright stopped before running any test. See the output below.
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
