import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Plan, PlanResponse } from '../../api/types';
import { Badge } from '../../components/Badge';
import { CloseButton } from '../../components/CloseButton';
import { PlanNoProdBadge } from '../../components/NoProdBadge';
import { ErrorBox, Loading } from '../../components/Callouts';
import { Facts } from '../../components/Facts';
import { LoginsNote } from '../../components/LoginsNote';
import { Modal } from '../../components/Modal';
import { PlanMarkdown } from '../../components/PlanMarkdown';
import { PlanOverview } from '../../components/PlanOverview';
import { PlanRunButton } from '../../components/PlanRunButton';
import { ToggleButton } from '../../components/ToggleButton';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { loginsFact } from '../../components/LoginBadges';
import { offProdReason } from '../../lib/prod';
import { PLAN_STATUS } from '../../lib/status';
import { PanelCases } from './PanelCases';
import { RunRefused, useRunRefusal } from './RunRefused';
import { RunOptionsContext, runBody, useRunOptions } from './runOptions';

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
  onClose,
  projects,
  headed,
  a11y,
  activeRun,
  openCase = null,
}: {
  slug: string;
  suite: string; // the suite page it's on; runs started here link back
  onClose: () => void;
  projects: string[]; // the suite's projects for this plan
  headed: boolean;
  a11y: boolean; // scan the pages for accessibility
  activeRun: string | null;
  openCase?: string | null; // a case whose row starts opened
}) {
  const { currentEnv } = useEnv();
  const { data, error } = useApi<PlanResponse>(
    `/api/plans/${slug}?env=${currentEnv.id}`,
  );
  const ref = useRef<HTMLElement>(null);
  // The Test files row stays folded until asked for.
  const [showTests, setShowTests] = useState(false);
  // The whole plan file, read in a modal.
  const [showPlan, setShowPlan] = useState(false);
  const factsId = useId();
  // Why the last Run press (the plan's or a case's) didn't start a run.
  const { refusal, onError: onRunError } = useRunRefusal();

  // Move focus into the panel when it opens, so keyboard and screen reader
  // users land on what they asked for.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Escape closes the panel, unless it's closing the full-plan modal (or
  // anything else on top, such as the Login Sessions popover).
  useEscapeToClose(onClose, !showPlan);

  // How every Run button in the panel runs (runOptions.tsx).
  const runOptions = useMemo(
    () => ({ suite, projects, headed, a11y, activeRun, onRunError }),
    [suite, projects, headed, a11y, activeRun, onRunError],
  );

  const plan = data?.plan;

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
          <h2 id="plan-panel-heading">{plan ? plan.name : slug}</h2>
          {plan && (
            <>
              <Badge map={PLAN_STATUS} value={plan.status} />
              <PlanNoProdBadge plan={plan} />
            </>
          )}
        </div>
        <div className="card-head-actions">
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
              title={plan.name}
              className="plan-modal"
              onClose={() => {
                setShowPlan(false);
                ref.current?.focus();
              }}
            >
              <PlanMarkdown slug={plan.slug} />
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
              <p className="actions">
                <RunPlanButton plan={plan} />
              </p>
            )}
            <PanelCases plan={plan} openCase={openCase} />
          </RunOptionsContext.Provider>
        </>
      )}
    </aside>
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
          ? 'Another run is in progress'
          : (blocked ?? `Run every case of ${plan.name} on ${currentEnv.name}`)
      }
    >
      Run plan on {currentEnv.name}
    </PlanRunButton>
  );
}
