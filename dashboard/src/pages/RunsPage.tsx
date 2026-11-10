import type { RunsResponse } from '../api/types';
import { ActiveRunBanner, ErrorBox, Loading } from '../components/Callouts';
import { RunsTable } from '../components/RunsTable';
import { useApi } from '../hooks/useApi';

// #/runs — every run started from the dashboard.
export function RunsPage() {
  const { data, error } = useApi<RunsResponse>('/api/runs');
  return (
    <>
      <h1>Runs</h1>
      <p className="lede">
        Test runs started from this dashboard. Each keeps its output and
        Playwright report in reports/dashboard-runs/.
      </p>
      {error ? (
        <ErrorBox>{error.message}</ErrorBox>
      ) : data ? (
        <div>
          <ActiveRunBanner runId={data.activeRun} />
          <RunsTable runs={data.runs} />
        </div>
      ) : (
        <Loading />
      )}
    </>
  );
}
