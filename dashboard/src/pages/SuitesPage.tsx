import { Link } from 'react-router';
import type { SuiteSummary, SuitesResponse } from '../api/types';
import { ActiveRunBanner, ErrorBox, Loading } from '../components/Callouts';
import { LastRunLink } from '../components/LastRunLink';
import { Table } from '../components/Table';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { plural } from '../lib/format';

// #/suites — every suite in test-suites/, with its last run here.
export function SuitesPage() {
  const { currentEnv } = useEnv();
  const { data, error } = useApi<SuitesResponse>(
    `/api/suites?env=${currentEnv.id}`,
  );

  return (
    <>
      <h1>Suites</h1>
      <p className="lede">
        A suite is one run made of several steps: test plans and checks Claude
        does in a browser. Suites are the files in test-suites/.
      </p>
      {error ? (
        <ErrorBox>{error.message}</ErrorBox>
      ) : !data ? (
        <Loading>Loading suites…</Loading>
      ) : (
        <div>
          <ActiveRunBanner runId={data.activeRun} />
          {data.suites.length ? (
            <SuiteTable suites={data.suites} />
          ) : (
            <p className="note">
              No suites yet. Add one to test-suites/ (see
              test-suites/README.md).
            </p>
          )}
        </div>
      )}
    </>
  );
}

function SuiteTable({ suites }: { suites: SuiteSummary[] }) {
  const { currentEnv } = useEnv();
  return (
    <Table
      rows={suites}
      rowKey={(suite) => suite.slug}
      columns={[
        {
          head: 'Suite',
          cell: (suite) => (
            <>
              <Link to={`/suites/${suite.slug}`} className="strong">
                {suite.name}
              </Link>
              {suite.summary && (
                <div className="note small">{suite.summary}</div>
              )}
            </>
          ),
        },
        {
          head: 'Steps',
          cell: (suite) =>
            [
              plural(suite.plans.length, 'plan'),
              plural(suite.prompts.length, 'prompt'),
            ].join(' · '),
        },
        {
          head: `Last run on ${currentEnv.name}`,
          cell: (suite) => <LastRunLink run={suite.lastRun} />,
        },
      ]}
    />
  );
}
