import type { Env } from '../api/types';

// A small tag with an environment's name. Old runs only recorded the host,
// passed as `site`.
export function EnvTag({ env, site }: { env?: Env; site?: string }) {
  if (!env && !site) return null;
  return (
    <span
      className={`env-tag${env?.production ? ' production' : ''}`}
      title={env?.baseURL ?? site}
    >
      {env?.name ?? site}
    </span>
  );
}
