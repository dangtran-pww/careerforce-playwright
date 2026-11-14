import { Link } from 'react-router';
import type { A11yRunsResponse } from '../../api/types';
import { ActiveRunBanner, ErrorBox, Loading } from '../../components/Callouts';
import { RunsTable } from '../../components/RunsTable';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { JourneyForm } from './JourneyForm';

// #/a11y — accessibility scans that follow a journey instead of a list of
// pages: Claude follows one described here, or a plan or suite run scans
// every page its tests reach. Both scan each page and dialog with axe
// (WCAG 2.2 A/AA) as the journey's user, so pages behind IDs and logins are
// covered. Below: the recent runs that scanned.
export function A11yPage() {
  const { currentEnv } = useEnv();
  const { data, error } = useApi<A11yRunsResponse>(
    `/api/a11y/runs?env=${currentEnv.id}`,
  );
  return (
    <div className="page-wide">
      <h1>Accessibility Scan</h1>
      <p className="lede">
        Scans follow a journey: every page and dialog it reaches is checked with
        axe against the WCAG 2.2 A and AA rules, as the journey’s user. Results
        are grouped by page, with IDs in the URL taken out
        (/user/&#123;id&#125;/edit).
      </p>
      <section className="card" aria-labelledby="tests-heading">
        <h2 id="tests-heading">Scan with your tests</h2>
        <p>
          On a <Link to="/suites">suite</Link>’s page, tick{' '}
          <strong>Scan pages for accessibility</strong> and run the suite, a
          plan or some cases. Every page their tests and prompt cases reach is
          scanned, logged in as they log in.
        </p>
      </section>
      <JourneyForm />
      <h2 className="section-title">
        Recent accessibility runs on {currentEnv.name}
      </h2>
      {error ? (
        <ErrorBox>{error.message}</ErrorBox>
      ) : !data ? (
        <Loading>Loading runs…</Loading>
      ) : (
        <>
          <ActiveRunBanner runId={data.activeRun} />
          <RunsTable runs={data.runs} showA11y />
        </>
      )}
    </div>
  );
}
