import { Link } from 'react-router';
import type { RunsResponse } from '../api/types';
import { ErrorBox, Loading } from '../components/Callouts';
import { RunsTable } from '../components/RunsTable';
import { SessionCard } from '../components/SessionCard';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';

// #/ — the admin session for the current environment, and the latest runs.
export function OverviewPage() {
  const { currentEnv } = useEnv();
  const { data, error } = useApi<RunsResponse>('/api/runs');

  return (
    <>
      <h1>Overview</h1>
      <p className="lede">
        Whether the saved logins for {currentEnv.name} still work. Tests that
        need a role are skipped or fail when its session has expired. Each
        environment has its own logins: pick another in the header to check it.
      </p>
      <div className="grid">
        <SessionCard role="admin" />
      </div>
      <div className="section-head">
        <h2>Recent runs</h2>
        <span>
          <Link to="/suites">Run a suite</Link> ·{' '}
          <Link to="/plans">Run a test plan →</Link>
        </span>
      </div>
      <div>
        {error ? (
          <ErrorBox>{error.message}</ErrorBox>
        ) : data ? (
          <RunsTable runs={data.runs.slice(0, 5)} />
        ) : (
          <Loading />
        )}
      </div>
    </>
  );
}
