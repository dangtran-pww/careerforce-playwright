import { Link } from 'react-router';
import type { SuiteSummary, SuitesResponse } from '../api/types';
import { ActiveRunBanner, ErrorBox, Loading } from '../components/Callouts';
import { SuiteResults } from '../components/SuiteResults';
import { Table } from '../components/Table';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { plural } from '../lib/format';
import { inline } from '../lib/inline';

// #/suites — every suite in test-suites/: the ones with plans in a table
// with their latest results here, then the planned ones (no plans yet).
// Wide, like the suite pages it links to.
export function SuitesPage() {
  const { currentEnv } = useEnv();
  const { data, error } = useApi<SuitesResponse>(
    `/api/suites?env=${currentEnv.id}`,
  );

  return (
    <div className="page-wide">
      <h1>Suites</h1>
      <p className="lede">
        Test plans grouped by what they check. Smoke checks that a deploy
        didn&apos;t break the main parts of the site; the functional suites go
        deeper into one feature. Open a suite to run its plans.
      </p>
      {error ? (
        <ErrorBox>{error.message}</ErrorBox>
      ) : !data ? (
        <Loading>Loading suites…</Loading>
      ) : (
        <SuiteLists suites={data.suites} activeRun={data.activeRun} />
      )}
    </div>
  );
}

function SuiteLists({
  suites,
  activeRun,
}: {
  suites: SuiteSummary[];
  activeRun: string | null;
}) {
  if (!suites.length)
    return (
      <p className="note">
        No suites yet. Add a folder with a suite.md to test-suites/ (see
        test-suites/README.md).
      </p>
    );
  const ready = suites.filter((s) => s.plans.length);
  const planned = suites.filter((s) => !s.plans.length);
  return (
    <>
      <ActiveRunBanner runId={activeRun} />
      {ready.length > 0 && <SuiteTable suites={ready} />}
      {planned.length > 0 && <PlannedSuites suites={planned} />}
    </>
  );
}

function SuiteTable({ suites }: { suites: SuiteSummary[] }) {
  const { currentEnv } = useEnv();
  return (
    <div className="suite-table">
      <Table
        rows={suites}
        rowKey={(suite) => suite.slug}
        rowLink={(suite) => `/suites/${suite.slug}`}
        columns={[
          {
            head: 'Suite',
            cell: (suite) => (
              <>
                <SuiteName suite={suite} />
                <SuiteSummaryText suite={suite} />
                {/* On phones the other columns drop out; their values
                    show here instead. */}
                <div className="narrow-only suite-narrow">
                  <div className="note small">
                    <PlanCounts suite={suite} />
                  </div>
                  <SuiteResults suite={suite} />
                </div>
              </>
            ),
          },
          {
            head: 'Plans',
            className: 'cell-nowrap',
            wideOnly: true,
            cell: (suite) => (
              <>
                {plural(suite.plans.length, 'plan')}
                <div className="note small">{whatRuns(suite)}</div>
              </>
            ),
          },
          {
            head: (
              <span title="Each plan's latest run of all its cases">
                Latest results on {currentEnv.name}
              </span>
            ),
            className: 'cell-results',
            wideOnly: true,
            cell: (suite) => <SuiteResults suite={suite} />,
          },
        ]}
      />
    </div>
  );
}

// The suites with no plans yet: a quieter list after the table.
function PlannedSuites({ suites }: { suites: SuiteSummary[] }) {
  return (
    <section aria-labelledby="planned-suites-heading">
      <h2 id="planned-suites-heading" className="plan-group-title">
        Planned: no plans yet
      </h2>
      <ul className="planned-suites">
        {suites.map((suite) => (
          <li key={suite.slug}>
            <Link to={`/suites/${suite.slug}`} className="suite-name">
              {suite.name}
            </Link>
            <SuiteSummaryText suite={suite} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuiteName({ suite }: { suite: SuiteSummary }) {
  return (
    <div className="suite-title">
      <Link to={`/suites/${suite.slug}`} className="suite-name strong">
        {suite.name}
      </Link>
    </div>
  );
}

// Its summary, cut to two lines; the whole text is on hover, and on its page.
function SuiteSummaryText({ suite }: { suite: SuiteSummary }) {
  if (!suite.summary) return null;
  return (
    <p
      className="suite-summary note small"
      title={suite.summary.replace(/`/g, '')}
    >
      {inline(suite.summary)}
    </p>
  );
}

function PlanCounts({ suite }: { suite: SuiteSummary }) {
  return (
    <>
      {plural(suite.plans.length, 'plan')} · {whatRuns(suite)}
    </>
  );
}

// What its runnable plans run: their tests (in the projects the suite
// picks), or their cases when they are all prompt cases, or nothing yet.
function whatRuns(suite: SuiteSummary) {
  const runnable = suite.plans.filter((p) => p.runnable);
  if (!runnable.length) return 'Not generated yet';
  const tests = runnable.reduce((n, p) => n + p.testCount, 0);
  if (tests) return plural(tests, 'test');
  return plural(
    runnable.reduce((n, p) => n + (p.caseCount ?? 0), 0),
    'case',
  );
}
