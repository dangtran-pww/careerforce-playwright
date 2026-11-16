import { useEffect, useRef, useState } from 'react';
import type { RolesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { useLoginsMenuState } from '../hooks/useLogins';
import { ErrorBox, Loading } from './Callouts';
import { CloseButton } from './CloseButton';
import { EnvTag } from './EnvTag';
import { InfoTip } from './InfoTip';
import { RefreshIcon, SessionRow } from './SessionRow';

// The header's "Login Sessions" button and the panel it opens: one compact
// row per role (SessionRow), in the order the server gives (ROLES in
// tests/helpers/environments.mts), for the environment picked in the header.
// On a page that runs tests (the suite page), the roles its chosen steps need
// come first (useLogins.tsx). "Check all" checks every row again.
//
// The panel is a native popover, so Esc and a click outside close it. Its
// rows are only made the first time it opens, because each one asks the
// site; after that they stay mounted while hidden, so reopening shows the
// last answer instead of checking every role again.
//
// It sits with the page links in the nav, and the panel opens below the
// button with their right edges lined up, moved right if that would put it
// past the left side of the window.
export function LoginsMenu() {
  const { currentEnv } = useEnv();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [open, setOpen] = useState(false);
  const { needed, round, recheck, registerOpener } = useLoginsMenuState();

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
      const width = Math.min(840, window.innerWidth - 32);
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
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (isOpen) setOpened(true);
    };
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
      >
        Login Sessions <span aria-hidden="true">▾</span>
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
              disabled={!opened}
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
        {opened && (
          <RoleRows
            key={currentEnv.id}
            envId={currentEnv.id}
            needed={needed}
            round={round}
          />
        )}
      </div>
    </div>
  );
}

// One flat grid, so a row keeps its state (and doesn't ask the site again)
// when ticking a step moves its role between the two groups. `round` remakes
// every row, which checks them all again.
function RoleRows({
  envId,
  needed,
  round,
}: {
  envId: string;
  needed: string[] | null;
  round: number;
}) {
  const { data, error } = useApi<RolesResponse>(`/api/roles?env=${envId}`);
  if (error) return <ErrorBox>{error.message}</ErrorBox>;
  if (!data) return <Loading>Finding the roles the tests use…</Loading>;

  const row = (role: string) => (
    <SessionRow key={`row:${role}:${round}`} role={role} />
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
