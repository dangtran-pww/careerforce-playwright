import { useNavigate } from 'react-router';
import { post } from '../api/client';
import { useEnv } from './useEnv';

// Returns start(path, body): POST a run request on the current environment,
// then open the new run's page. On failure it calls `onError`, or says why
// in an alert when there is none.
//
//   const start = useStartRun();
//   await start(`/api/plans/${plan.slug}/run`, { cases: ['AM-1'] });
export function useStartRun(onError?: (err: Error) => void) {
  const navigate = useNavigate();
  const { currentEnv } = useEnv();

  return async (path: string, body: object = {}) => {
    try {
      const run = await post<{ id: string }>(path, {
        env: currentEnv.id,
        ...body,
      });
      navigate(`/runs/${run.id}`);
    } catch (err) {
      if (onError) return onError(err as Error);
      alert(`Couldn't start the run: ${(err as Error).message}`);
    }
  };
}
