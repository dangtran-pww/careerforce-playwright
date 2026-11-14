import { useEffect, useRef, useState } from 'react';
import type { RolesResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { useLoginsMenuState } from '../hooks/useLogins';
import { ErrorBox, Loading } from './Callouts';
import { CloseButton } from './CloseButton';
import { EnvTag } from './EnvTag';
import { SessionCard } from './SessionCard';

// The header's "Login Sessions" button and the panel it opens: one session card per
// role, in two columns (one on narrow windows): admin, and every role a plan,
// suite prompt or saved session uses,
// for the environment picked in the header. On a page that runs tests (the
// suite page), the roles its chosen steps need come first (useLogins.tsx).
//
// The panel is a native popover, so Esc and a click outside close it. Its
// cards are only made the first time it opens, because each one asks the
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
  const { needed, round, registerOpener } = useLoginsMenuState();

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
      const width = Math.min(920, window.innerWidth - 32);
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
          <CloseButton
            label="Close login sessions"
            popoverTarget="logins-panel"
            popoverTargetAction="hide"
          />
        </div>
        <p className="note small">
          Tests that need a role are skipped or fail when its session has
          expired. Each environment has its own logins.
        </p>
        {/* Keyed by environment: picking another one starts fresh. */}
        {opened && (
          <RoleCards
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

// One flat list, so a card keeps its state (and doesn't ask the site again)
// when ticking a step moves its role between the two groups. `round` remakes
// every card, which checks them all again.
function RoleCards({
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

  // Under a group heading (h3) the cards are h4; without groups, h3.
  const card = (role: string) => (
    <SessionCard
      key={`card:${role}:${round}`}
      role={role}
      headingLevel={needed ? 4 : 3}
    />
  );
  if (!needed) return <div className="logins-list">{data.roles.map(card)}</div>;

  const others = data.roles.filter((r) => !needed.includes(r));
  const items = [
    <h3 key="needed" className="logins-group">
      Needed by the chosen steps
    </h3>,
    ...(needed.length
      ? needed.map(card)
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
          ...others.map(card),
        ]
      : []),
  ];
  return <div className="logins-list">{items}</div>;
}
