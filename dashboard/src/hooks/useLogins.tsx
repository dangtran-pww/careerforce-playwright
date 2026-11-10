// Shared state for the header's Login Sessions panel (LoginsMenu.tsx).
//
// A page that runs tests says which roles its chosen steps log in as:
//
//   useNeededLogins(['admin', 'job-seeker']);  // [] = needs none
//
// and the panel lists those first, under "Needed by the chosen steps". It
// stops when the page goes away. A page can also open the panel and make its
// cards check again:
//
//   const { openPanel, recheck } = useLoginsPanel();

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface LoginsState {
  // Roles the current page needs; null when the page doesn't say.
  needed: string[] | null;
  setNeeded: (roles: string[] | null) => void;
  // Bumped to make every card check again.
  round: number;
  recheck: () => void;
  openPanel: () => void;
  // LoginsMenu hands over how to open its popover.
  registerOpener: (open: (() => void) | null) => void;
}

const LoginsContext = createContext<LoginsState | null>(null);

function useLoginsState(): LoginsState {
  const state = useContext(LoginsContext);
  if (!state) throw new Error('Use inside <LoginsProvider>');
  return state;
}

export function LoginsProvider({ children }: { children: ReactNode }) {
  const [needed, setNeeded] = useState<string[] | null>(null);
  const [round, setRound] = useState(0);
  const opener = useRef<(() => void) | null>(null);
  // Stable, so pages can use them in effects and callbacks.
  const recheck = useCallback(() => setRound((r) => r + 1), []);
  const openPanel = useCallback(() => opener.current?.(), []);
  const registerOpener = useCallback((open: (() => void) | null) => {
    opener.current = open;
  }, []);

  const value = useMemo<LoginsState>(
    () => ({ needed, setNeeded, round, recheck, openPanel, registerOpener }),
    [needed, round, recheck, openPanel, registerOpener],
  );
  return (
    <LoginsContext.Provider value={value}>{children}</LoginsContext.Provider>
  );
}

// For LoginsMenu: everything above.
export const useLoginsMenuState = useLoginsState;

// For pages: the roles their chosen steps need, kept until they unmount.
export function useNeededLogins(roles: string[]) {
  const { setNeeded } = useLoginsState();
  // Compared by value: the page builds a new array on every render.
  const key = roles.join(',');
  useEffect(() => {
    setNeeded(key ? key.split(',') : []);
  }, [key, setNeeded]);
  useEffect(() => () => setNeeded(null), [setNeeded]);
}

export function useLoginsPanel() {
  const { openPanel, recheck } = useLoginsState();
  return { openPanel, recheck };
}
