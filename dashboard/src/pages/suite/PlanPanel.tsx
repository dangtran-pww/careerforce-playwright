import { useEffect, useId, useRef, useState } from 'react';
import type { Plan, PlanResponse } from '../../api/types';
import { Badge } from '../../components/Badge';
import { CloseButton } from '../../components/CloseButton';
import { PlanNoProdBadge } from '../../components/NoProdBadge';
import { ErrorBox, Loading } from '../../components/Callouts';
import { Facts } from '../../components/Facts';
import { Modal } from '../../components/Modal';
import { PlanMarkdown } from '../../components/PlanMarkdown';
import { PlanOverview } from '../../components/PlanOverview';
import { PlanRunButton } from '../../components/PlanRunButton';
import { ToggleButton } from '../../components/ToggleButton';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { offProdReason } from '../../lib/prod';
import { PLAN_STATUS } from '../../lib/status';
import { PanelCases } from './PanelCases';

export const PLAN_PANEL_ID = 'plan-panel';

// The right-hand panel on the suite page: one plan's details. Each case
// opens to show its steps and expected result, and can be run on its own;
// the button under the cases runs the whole plan. Both run in the projects
// the suite runs the plan in. Escape or the close button
// hides the panel. Give it key={slug} so a new plan starts fresh instead of
// showing the last one while it loads.
export function PlanPanel({
  slug,
  suite,
  onClose,
  projects,
  headed,
  activeRun,
}: {
  slug: string;
  suite: string; // the suite page it's on; runs started here link back
  onClose: () => void;
  projects: string[]; // the suite's projects for this plan
  headed: boolean;
  activeRun: string | null;
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

  // Move focus into the panel when it opens, so keyboard and screen reader
  // users land on what they asked for.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Escape closes the panel, unless it's closing the full-plan modal.
  useEffect(() => {
    if (showPlan) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showPlan]);

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
                ['Logins', plan.roles.length ? plan.roles.join(', ') : 'none'],
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
          <PanelCases
            plan={plan}
            suite={suite}
            projects={projects}
            headed={headed}
            activeRun={activeRun}
          />
          {plan.runnable && (
            <p className="actions">
              <RunPlanButton
                plan={plan}
                suite={suite}
                projects={projects}
                headed={headed}
                activeRun={activeRun}
              />
            </p>
          )}
        </>
      )}
    </aside>
  );
}

// Runs the whole plan on the environment picked in the header, in the
// projects the suite runs it in. On production the server leaves out the
// no-prod cases.
function RunPlanButton({
  plan,
  suite,
  projects,
  headed,
  activeRun,
}: {
  plan: Plan;
  suite: string;
  projects: string[];
  headed: boolean;
  activeRun: string | null;
}) {
  const { currentEnv } = useEnv();
  const blocked = currentEnv.production ? offProdReason(plan) : null;
  return (
    <PlanRunButton
      plan={plan}
      body={{
        projects: projects.length ? projects : undefined,
        headed,
        suite,
      }}
      disabled={Boolean(activeRun) || Boolean(blocked)}
      title={
        activeRun
          ? 'Another run is in progress'
          : (blocked ?? `Run every case of ${plan.name} on ${currentEnv.name}`)
      }
    >
      Run plan on {currentEnv.name}
    </PlanRunButton>
  );
}
