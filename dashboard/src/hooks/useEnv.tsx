// The environments to pick from and the one picked in the header.
//
// <EnvProvider> loads them once and wraps the app; any component reads them
// with useEnv(). The pick is remembered per browser in localStorage.

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Env, EnvironmentsResponse } from '../api/types';
import { ErrorBox } from '../components/Callouts';
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

  if (error)
    return (
      <main>
        <ErrorBox>
          Couldn't load the environments: {error.message}. Is npm run dashboard
          still running?
        </ErrorBox>
      </main>
    );
  if (!data) return null;

  const { environments } = data;
  const envById = (id: string | undefined | null) =>
    environments.find((e) => e.id === id);
  const currentEnv =
    envById(pickedId) ?? envById(data.default) ?? environments[0];

  const setCurrentEnv = (id: string) => {
    storeEnvId(id);
    setPickedId(id);
  };

  return (
    <EnvContext.Provider
      value={{ environments, currentEnv, envById, setCurrentEnv }}
    >
      {children}
    </EnvContext.Provider>
  );
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
