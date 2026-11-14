// The environments to pick from and the one picked in the header.
//
// <EnvProvider> loads them once and wraps the app; any component reads them
// with useEnv(). The pick is remembered per browser in localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Env, EnvironmentsResponse } from '../api/types';
import { ErrorBox, Loading } from '../components/Callouts';
import { useApi } from './useApi';

interface EnvState {
  environments: Env[];
  currentEnv: Env;
  envById: (id: string | undefined | null) => Env | undefined;
  setCurrentEnv: (id: string) => void;
}

const EnvContext = createContext<EnvState | null>(null);

export function useEnv(): EnvState {
  const state = useContext(EnvContext);
  if (!state) throw new Error('useEnv() must be used inside <EnvProvider>');
  return state;
}

export function EnvProvider({ children }: { children: ReactNode }) {
  const { data, error } = useApi<EnvironmentsResponse>('/api/environments');
  const [pickedId, setPickedId] = useState(storedEnvId);

  const setCurrentEnv = useCallback((id: string) => {
    storeEnvId(id);
    setPickedId(id);
  }, []);

  // Memoized, so a render here doesn't re-render every useEnv() reader.
  const value = useMemo<EnvState | null>(() => {
    if (!data?.environments.length) return null;
    const { environments } = data;
    const envById = (id: string | undefined | null) =>
      environments.find((e) => e.id === id);
    const currentEnv =
      envById(pickedId) ?? envById(data.default) ?? environments[0];
    return { environments, currentEnv, envById, setCurrentEnv };
  }, [data, pickedId, setCurrentEnv]);

  if (error)
    return (
      <main>
        <ErrorBox>
          Couldn't load the environments: {error.message}. Is npm run dashboard
          still running?
        </ErrorBox>
      </main>
    );
  if (!data)
    return (
      <main>
        <Loading>Loading the dashboard…</Loading>
      </main>
    );
  if (!value)
    return (
      <main>
        <ErrorBox>The dashboard server lists no environments.</ErrorBox>
      </main>
    );

  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

const STORAGE_KEY = 'dashboard.env';

// Storage can be off; then the default is used.
function storedEnvId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeEnvId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not remembered; the default is used next time.
  }
}
