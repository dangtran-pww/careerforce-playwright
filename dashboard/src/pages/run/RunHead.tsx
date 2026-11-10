import { useState } from 'react';
import { Link } from 'react-router';
import { post } from '../../api/client';
import type { Run } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Command } from '../../components/Command';
import { EnvTag } from '../../components/EnvTag';
import { Facts } from '../../components/Facts';
import { TitleRow } from '../../components/PageTitle';
import { TimeAgo } from '../../components/TimeAgo';
import { duration } from '../../lib/format';
import { runDuration, runOwnerPath, whatRan } from '../../lib/runs';
import { RUN_STATUS } from '../../lib/status';

// Title, facts and actions at the top of the run page.
export function RunHead({ run }: { run: Run }) {
  const running = run.status === 'running';
  const isSuite = run.kind === 'suite';

  return (
    <>
      <TitleRow title={run.planName}>
        <Badge map={RUN_STATUS} value={run.status} role="status" />
      </TitleRow>
      <Facts
        plain
        items={[
          [
            'Started',
            <>
              <TimeAgo iso={run.startedAt} /> ·{' '}
              {running ? 'running for' : 'took'} {duration(runDuration(run))}
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
          !isSuite && [
            'Cases',
            run.cases.length ? run.cases.join(', ') : 'All',
          ],
          !isSuite && ['Projects', run.projects.join(', ')],
          run.command && ['Command', <Command text={run.command} />],
        ]}
      />
      <div className="actions">
        {running && <StopButton runId={run.id} />}
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
              : 'Back to the plan to run again'}
          </Link>
        )}
      </div>
    </>
  );
}

// Stays disabled once asked: the next poll shows the run stopping.
function StopButton({ runId }: { runId: string }) {
  const [stopping, setStopping] = useState(false);
  return (
    <button
      type="button"
      className="danger"
      disabled={stopping}
      onClick={async () => {
        setStopping(true);
        await post(`/api/runs/${runId}/stop`).catch((err: Error) => {
          alert(err.message);
          setStopping(false);
        });
      }}
    >
      {stopping ? 'Stopping…' : 'Stop run'}
    </button>
  );
}
