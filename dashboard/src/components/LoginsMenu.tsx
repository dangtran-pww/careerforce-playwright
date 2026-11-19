import { useCallback, useEffect, useRef, useState } from 'react';
import type { RolesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { useLoginsMenuState } from '../hooks/useLogins';
import { ErrorBox, Loading } from './Callouts';
import { CloseButton } from './CloseButton';
import { EnvTag } from './EnvTag';
import { InfoTip } from './InfoTip';
import { NEEDS_LOGIN, RefreshIcon, SessionRow } from './SessionRow';

// The header's "Login Sessions" button and the panel it opens: one compact
// row per role (SessionRow), in the order the server gives (ROLES in
// tests/helpers/environments.mts), for the environment picked in the header.
// On a page that runs tests (the suite page), the roles its chosen steps need
// come first (useLogins.tsx). "Check all" checks every row again.
//
// The panel is a native popover, so Esc and a click outside close it. Its
// rows are made when the page loads and stay mounted while hidden: each one
// checks its role once, and reports what it found, so the button can show
// how many roles need logging in (the ones the page needs, when it says)
// without being opened. Reopening shows the last answers.
//
// It sits with the page links in the nav, and the panel opens below the
// button with their right edges lined up, moved right if that would put it
// past the left side of the window.
export function LoginsMenu() {
  const { currentEnv } = useEnv();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { needed, round, recheck, registerOpener } = useLoginsMenuState();

  // Each row's status, per environment, so a switch doesn't count the last
  // environment's roles.
  const [statuses, setStatuses] = useState<
    Record<string, Record<string, string>>
  >({});
  const reportStatus = useCallback(
    (envId: string, role: string, status: string) =>
      setStatuses((all) =>
        all[envId]?.[role] === status
          ? all
          : { ...all, [envId]: { ...all[envId], [role]: status } },
      ),
    [],
  );
  const count = sessionCount(statuses[currentEnv.id] ?? {}, needed);

  // Lets pages open the panel, e.g. when a run is refused over logins.
  useEffect(() => {
    registerOpener(() => panelRef.current?.showPopover());
    return () => registerOpener(null);
  }, [registerOpener]);

  useEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!panel || !button) return;
    // Matches .logins-panel's width in styles/logins-menu.css.
    const place = () => {
      const width = Math.min(980, window.innerWidth - 32);
      const left = Math.max(
        16,
        Math.min(
          button.getBoundingClientRect().right - width,
          window.innerWidth - 16 - width,
        ),
      );
      panel.style.setProperty('--logins-left', `${left}px`);
    };
    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') place();
    };
    const onToggle = (e: Event) =>
      setOpen((e as ToggleEvent).newState === 'open');
    panel.addEventListener('beforetoggle', onBeforeToggle);
    panel.addEventListener('toggle', onToggle);
    window.addEventListener('resize', place);
    return () => {
      panel.removeEventListener('beforetoggle', onBeforeToggle);
      panel.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', place);
    };
  }, []);

  return (
    <div className="logins-menu">
      <button
        ref={buttonRef}
        type="button"
        className="logins-button"
        popoverTarget="logins-panel"
        aria-expanded={open}
        aria-controls="logins-panel"
        title={
          count ? `${count.n} ${count.text} on ${currentEnv.name}` : undefined
        }
      >
        {/* "Login" is for screen readers only on a phone, so the button
            fits beside the page links (styles/logins-menu.css). */}
        <span className="logins-word">Login </span>Sessions
        {count && (
          <span className={`badge badge-${count.tone} logins-count`}>
            {count.n}
            <span className="visually-hidden"> {count.text}</span>
          </span>
        )}{' '}
        <span aria-hidden="true">▾</span>
      </button>
      <div
        id="logins-panel"
        className="logins-panel"
        popover="auto"
        ref={panelRef}
        role="dialog"
        aria-labelledby="logins-panel-heading"
      >
        <div className="logins-panel-head">
          <h2 id="logins-panel-heading">
            Login sessions on <EnvTag env={currentEnv} />
          </h2>
          <div className="logins-panel-actions">
            <InfoTip label="About login sessions">
              Tests that need a role are skipped or fail when its session has
              expired. Each environment has its own logins.
            </InfoTip>
            <button
              type="button"
              className="logins-check-all"
              onClick={recheck}
            >
              <RefreshIcon /> Check all
            </button>
            <CloseButton
              label="Close login sessions"
              popoverTarget="logins-panel"
              popoverTargetAction="hide"
            />
          </div>
        </div>
        {/* Keyed by environment: picking another one starts fresh. */}
        <RoleRows
          key={currentEnv.id}
          envId={currentEnv.id}
          needed={needed}
          round={round}
          onStatus={reportStatus}
        />
      </div>
    </div>
  );
}

// The count on the button: roles that need logging in (red), or else roles
// that couldn't be checked (amber). Only the roles the page needs, when it
// says; none while every role is fine or still being checked.
function sessionCount(
  byRole: Record<string, string>,
  needed: string[] | null,
): { n: number; tone: string; text: string } | null {
  const statuses = Object.entries(byRole)
    .filter(([role]) => !needed || needed.includes(role))
    .map(([, status]) => status);
  const toLogIn = statuses.filter((s) => NEEDS_LOGIN.includes(s)).length;
  if (toLogIn)
    return {
      n: toLogIn,
      tone: 'bad',
      text: toLogIn === 1 ? 'role needs logging in' : 'roles need logging in',
    };
  const unchecked = statuses.filter((s) => s === 'error').length;
  if (unchecked)
    return {
      n: unchecked,
      tone: 'warn',
      text:
        unchecked === 1
          ? "role couldn't be checked"
          : "roles couldn't be checked",
    };
  return null;
}

// One flat grid, so a row keeps its state (and doesn't ask the site again)
// when ticking a step moves its role between the two groups. `round` remakes
// every row, which checks them all again.
function RoleRows({
  envId,
  needed,
  round,
  onStatus,
}: {
  envId: string;
  needed: string[] | null;
  round: number;
  onStatus: (envId: string, role: string, status: string) => void;
}) {
  const { data, error } = useApi<RolesResponse>(`/api/roles?env=${envId}`);
  if (error) return <ErrorBox>{error.message}</ErrorBox>;
  if (!data) return <Loading>Finding the roles the tests use…</Loading>;

  const row = (role: string) => (
    <SessionRow key={`row:${role}:${round}`} role={role} onStatus={onStatus} />
  );
  if (!needed) return <div className="logins-list">{data.roles.map(row)}</div>;

  const others = data.roles.filter((r) => !needed.includes(r));
  const items = [
    <h3 key="needed" className="logins-group">
      Needed by the chosen steps
    </h3>,
    ...(needed.length
      ? needed.map(row)
      : [
          <p key="none" className="note">
            The chosen steps need no login.
          </p>,
        ]),
    ...(others.length
      ? [
          <h3 key="others" className="logins-group">
            Other roles
          </h3>,
          ...others.map(row),
        ]
      : []),
  ];
  return <div className="logins-list">{items}</div>;
}
