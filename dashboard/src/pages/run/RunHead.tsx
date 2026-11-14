import { memo, useState } from 'react';
import { Link } from 'react-router';
import { post } from '../../api/client';
import type { Run } from '../../api/types';
import { AsyncButton } from '../../components/AsyncButton';
import { Badge } from '../../components/Badge';
import { Command } from '../../components/Command';
import { EnvTag } from '../../components/EnvTag';
import { Facts } from '../../components/Facts';
import { RerunButton } from '../../components/RerunButton';
import { TitleRow } from '../../components/PageTitle';
import { TimeAgo } from '../../components/TimeAgo';
import { UiModeButton } from '../../components/UiModeButton';
import { useEnv } from '../../hooks/useEnv';
import { useTick } from '../../hooks/useTick';
import { duration, testProgress } from '../../lib/format';
import { a11yCounts, runDuration, runOwnerPath, whatRan } from '../../lib/runs';
import { RUN_STATUS } from '../../lib/status';

// Title, facts and actions at the top of the run page. Memoized, like the
// results below it (RunPage.tsx).
export const RunHead = memo(function RunHead({ run }: { run: Run }) {
  const running = run.status === 'running';
  const isSuite = run.kind === 'suite';
  const isJourney = run.kind === 'a11y-journey';
  const { currentEnv } = useEnv();
  // Old runs recorded no environment; those ran on QA.
  const otherEnv = (run.env?.id ?? 'qa') !== currentEnv.id;

  return (
    <>
      <TitleRow title={run.planName}>
        <Badge
          map={RUN_STATUS}
          value={run.status}
          role="status"
          busy={running}
        />
      </TitleRow>
      <div className="card intro-card">
        <Facts
          items={[
            [
              'Started',
              <>
                <TimeAgo iso={run.startedAt} /> · <Elapsed run={run} />
              </>,
            ],
            [
              'Environment',
              <>
                <EnvTag env={run.env} site={run.site} />
                {run.env && ` ${run.env.baseURL}`}
              </>,
            ],
            isSuite && ['Steps', whatRan(run)],
            isJourney && ['Journey', whatRan(run)],
            !isSuite &&
              !isJourney && [
                'Cases',
                run.cases.length ? run.cases.join(', ') : 'All',
              ],
            !isSuite && !isJourney && ['Projects', run.projects.join(', ')],
            run.a11yScan && ['Accessibility', a11yCounts(run) ?? '—'],
            // While it runs, the progress bar below shows this.
            !isSuite &&
              !running &&
              run.tests && ['Tests', testProgress(run.tests, false)],
            run.command && ['Command', <Command text={run.command} />],
          ]}
        />
      </div>
      {!running && !isSuite && otherEnv && (
        <p className="callout">
          This run was on {run.env?.name ?? run.site}. Running it again uses the
          environment picked in the header: <EnvTag env={currentEnv} />{' '}
          {currentEnv.baseURL}
        </p>
      )}
      <div className="actions">
        {running && <StopButton runId={run.id} />}
        {!running && !isSuite && !isJourney && (
          <RerunButton
            planSlug={run.plan}
            body={{
              projects: run.projects,
              cases: run.cases,
              headed: run.headed,
              a11y: run.a11yScan,
            }}
          >
            {run.cases.length
              ? `Run ${run.cases.join(', ')} again`
              : 'Run again'}
          </RerunButton>
        )}
        {!running && !isSuite && !isJourney && (
          <UiModeButton
            planSlug={run.plan}
            body={{ projects: run.projects, cases: run.cases }}
          >
            {run.cases.length
              ? `Open ${run.cases.join(', ')} in UI mode`
              : 'Open in UI mode'}
          </UiModeButton>
        )}
        {!running && run.stats && !isSuite && (
          <a
            className="button"
            href={`/runs/${run.id}/report/`}
            target="_blank"
            rel="noopener"
          >
            Open Playwright report
          </a>
        )}
        {!running && (
          <Link className="button ghost" to={runOwnerPath(run)}>
            {isSuite
              ? 'Back to the suite to run again'
              : isJourney
                ? 'Back to start another journey'
                : run.suite
                  ? 'Back to the plan to pick what to run'
                  : 'Back to the suites'}
          </Link>
        )}
      </div>
    </>
  );
});

// "running for 1m 12s", counting up each second while the run goes, or
// "took 3m 4s" once it has ended.
function Elapsed({ run }: { run: Run }) {
  const running = run.status === 'running';
  useTick(1000, running);
  return (
    <>
      {running ? 'running for' : 'took'} {duration(runDuration(run))}
    </>
  );
}

// Stays disabled once asked: the next poll shows the run stopping. A
// refused stop shows why beside the button (AsyncButton).
function StopButton({ runId }: { runId: string }) {
  const [stopped, setStopped] = useState(false);
  return (
    <AsyncButton
      className="danger"
      busyLabel="Stopping…"
      disabled={stopped}
      onClick={async () => {
        await post(`/api/runs/${runId}/stop`);
        setStopped(true);
      }}
    >
      {stopped ? 'Stopping…' : 'Stop run'}
    </AsyncButton>
  );
}
