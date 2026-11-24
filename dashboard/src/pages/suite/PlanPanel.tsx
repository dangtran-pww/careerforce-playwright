import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Plan, PlanResponse, Run } from '../../api/types';
import { Badge } from '../../components/Badge';
import { CloseButton } from '../../components/CloseButton';
import { CopyButton } from '../../components/Command';
import { LastRunLink } from '../../components/LastRunLink';
import { PlanNoProdBadge } from '../../components/NoProdBadge';
import { ErrorBox, Loading } from '../../components/Callouts';
import { Facts } from '../../components/Facts';
import { LoginsNote } from '../../components/LoginsNote';
import { Modal } from '../../components/Modal';
import { PlanMarkdown } from '../../components/PlanMarkdown';
import { PlanOverview } from '../../components/PlanOverview';
import { PlanRunButton } from '../../components/PlanRunButton';
import { PlanStatusTip } from '../../components/PlanStatusTip';
import { RefreshButton, type Refresh } from '../../components/RefreshButton';
import { ToggleButton } from '../../components/ToggleButton';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { loginsFact } from '../../components/LoginBadges';
import { offProdReason } from '../../lib/prod';
import { PLAN_STATUS } from '../../lib/status';
import { PanelCases, runsTestsOnly } from './PanelCases';
import { RunRefused, useRunRefusal } from './RunRefused';
import {
  HeadedOption,
  RunOptionsContext,
  runBody,
  useRunOptions,
} from './runOptions';

export const PLAN_PANEL_ID = 'plan-panel';

// The right-hand panel on the suite page: one plan's details. Each case
// opens to show its steps and expected result, and can be run on its own;
// the button above the cases runs the whole plan. Both run in the projects
// the suite runs the plan in. Above that button the panel says which logins
// the plan needs; the server checks them before it starts any run, and when
// one isn't ready the panel says why and opens the Login sessions panel. Escape or the close button
// hides the panel. Give it key={slug} so a new plan starts fresh instead of
// showing the last one while it loads.
export function PlanPanel({
  slug,
  suite,
  suiteName,
  onClose,
  projects,
  activeRun,
  openCase = null,
  openFull = false,
}: {
  slug: string;
  suite: string; // the suite page it's on; runs started here link back
  suiteName: string; // shown before the plan's name in the heading
  onClose: () => void;
  projects: string[]; // the suite's projects for this plan
  activeRun: string | null;
  openCase?: string | null; // a case whose row starts opened
  openFull?: boolean; // start with the whole plan open (a link from another plan)
}) {
  const { currentEnv } = useEnv();
  const { data, error, loading, reload } = useApi<PlanResponse>(
    `/api/plans/${slug}?env=${currentEnv.id}`,
  );
  const ref = useRef<HTMLElement>(null);
  // The Test files row stays folded until asked for.
  const [showTests, setShowTests] = useState(false);
  // The whole plan file, read in a modal.
  const [showPlan, setShowPlan] = useState(openFull);
  // How far the whole plan was scrolled, so closing it by mistake (a click
  // outside) doesn't lose the reader's place.
  const fullPlanScroll = useRef(0);
  const factsId = useId();
  // Why the last Run press (the plan's or a case's) didn't start a run.
  const { refusal, onError: onRunError } = useRunRefusal();
  // Show the browser while the tests run (the tick beside Run test cases).
  const [headed, setHeaded] = useState(false);

  // Move focus into the panel when it opens, so keyboard and screen reader
  // users land on what they asked for. Without scrolling: the panel sticks
  // in view, and scrolling to it would jump the page.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // Escape closes the panel, unless it's closing the full-plan modal (or
  // anything else on top, such as the Login Sessions popover).
  useEscapeToClose(onClose, !showPlan);

  // How every Run button in the panel runs (runOptions.tsx).
  const runOptions = useMemo(
    () => ({ suite, projects, headed, setHeaded, activeRun, onRunError }),
    [suite, projects, headed, activeRun, onRunError],
  );

  const plan = data?.plan;
  // Reloads the panel (the header's icon and each opened case's). The old
  // plan stays shown while it reloads.
  const refresh: Refresh = {
    onRefresh: reload,
    refreshing: loading,
    failed: Boolean(error),
  };

  return (
    <aside
      id={PLAN_PANEL_ID}
      ref={ref}
      tabIndex={-1}
      className="side-panel card"
      aria-labelledby="plan-panel-heading"
    >
      <div className="card-head">
        <div className="card-head-title">
          <h2 id="plan-panel-heading">
            {suiteName}: {plan ? plan.name : slug}
          </h2>
          {plan && (
            // One group, so the badges wrap under the name together.
            <span className="plan-badges">
              <Badge map={PLAN_STATUS} value={plan.status} />
              <PlanStatusTip />
              <PlanNoProdBadge plan={plan} />
            </span>
          )}
        </div>
        <div className="card-head-actions">
          {(plan || error) && (
            <RefreshButton refresh={refresh} what={plan ? plan.name : slug} />
          )}
          {plan && (
            <button
              type="button"
              className="ghost small"
              aria-haspopup="dialog"
              onClick={() => setShowPlan(true)}
            >
              Read full plan
            </button>
          )}
          <CloseButton label="Close plan details" onClick={onClose} />
        </div>
      </div>
      {error ? (
        <ErrorBox>{error.message}</ErrorBox>
      ) : !plan ? (
        <Loading />
      ) : (
        <>
          <PlanOverview plan={plan} />
          {showPlan && (
            <Modal
              title={`${suiteName}: ${plan.name}`}
              className="plan-modal"
              actions={
                <>
                  <PlanLastRun runs={data.runs} />
                  <span className="modal-file">
                    <code>{plan.file}</code>
                    <CopyButton text={plan.file} label="Copy plan file path" />
                  </span>
                </>
              }
              onClose={() => {
                setShowPlan(false);
                ref.current?.focus({ preventScroll: true });
              }}
            >
              <PlanMarkdown slug={plan.slug} scrollMemory={fullPlanScroll} />
            </Modal>
          )}
          {plan.notes.map((n) => (
            <p key={n} className="callout callout-warn">
              {n}
            </p>
          ))}
          <div id={factsId} className="plan-facts">
            <Facts
              items={[
                ['Plan', <code>{plan.file}</code>],
                [
                  'Logins',
                  plan.roleCases
                    ? loginsFact(
                        plan.roleCases,
                        plan.cases.map((c) => c.id),
                      )
                    : plan.roles.length
                      ? plan.roles.join(', ')
                      : 'none',
                ],
                showTests && [
                  'Test files',
                  plan.files.map((f) => (
                    <div key={f}>
                      <code>{f}</code>
                    </div>
                  )),
                ],
              ]}
            />
          </div>
          {plan.files.length > 0 && (
            <ToggleButton
              inline
              open={showTests}
              controls={factsId}
              onToggle={() => setShowTests((o) => !o)}
            >
              {showTests
                ? 'Hide test files'
                : `Show test files (${plan.files.length})`}
            </ToggleButton>
          )}
          <RunOptionsContext.Provider value={runOptions}>
            {plan.runnable && <LoginsNote roles={planRoles(plan)} />}
            {refusal && <RunRefused refusal={refusal} />}
            {plan.runnable && (
              <>
                {/* With no Run test cases button, this one runs the tests. */}
                {runsTestsOnly(plan) && <HeadedOption />}
                <p className="actions">
                  <RunPlanButton plan={plan} />
                </p>
              </>
            )}
            <PanelCases plan={plan} openCase={openCase} refresh={refresh} />
          </RunOptionsContext.Provider>
        </>
      )}
    </aside>
  );
}

// The plan's last run on the environment picked in the header, for the
// whole-plan modal's title bar. Runs come newest first.
function PlanLastRun({ runs }: { runs: Run[] }) {
  const { currentEnv } = useEnv();
  const run = runs.find((r) => r.env?.id === currentEnv.id);
  return (
    <span className="modal-last-run">
      {run ? (
        <>
          Last run on {currentEnv.name}: <LastRunLink run={run} />
        </>
      ) : (
        `No runs on ${currentEnv.name} yet`
      )}
    </span>
  );
}

// The roles a run of the whole plan logs in as.
const planRoles = (plan: Plan) =>
  plan.roleCases?.map((rc) => rc.role) ?? plan.roles;

// Runs the whole plan on the environment picked in the header, in the
// projects the suite runs it in. On production the server leaves out the
// no-prod cases.
function RunPlanButton({ plan }: { plan: Plan }) {
  const { currentEnv } = useEnv();
  const options = useRunOptions();
  const blocked = currentEnv.production ? offProdReason(plan) : null;
  return (
    <PlanRunButton
      plan={plan}
      body={runBody(options)}
      onError={options.onRunError}
      busyLabel={planRoles(plan).length ? 'Checking logins…' : undefined}
      disabled={Boolean(options.activeRun) || Boolean(blocked)}
      title={
        options.activeRun
          ? `Another run is in progress on ${currentEnv.name}`
          : (blocked ?? `Run every case of ${plan.name} on ${currentEnv.name}`)
      }
    >
      Run plan on {currentEnv.name}
    </PlanRunButton>
  );
}
