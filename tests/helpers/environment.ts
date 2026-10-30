// GTM container ID differs by environment: one ID for prod, one shared across
// the lower environments (QA, stage, sandbox) per the source smoke-testing
// checklist. Confirmed on prod, QA, and stage (HP-3 run against stage,
// 2026-10-30); sandbox uses the same ID as QA.
const PROD_GTM_ID = 'GTM-WL36T6M';
const LOWER_ENV_GTM_ID = 'GTM-P8D2THV';

const PROD_HOSTS = ['careerforce.mn.gov', 'careerforcemn.com'];
const STAGE_HOSTS = ['stage.careerforce.link'];

export function isProd(baseUrl: string): boolean {
  return PROD_HOSTS.some((host) => new URL(baseUrl).hostname.endsWith(host));
}

export function isStage(baseUrl: string): boolean {
  return STAGE_HOSTS.some((host) => new URL(baseUrl).hostname.endsWith(host));
}

export function expectedGtmId(baseUrl: string): string {
  return isProd(baseUrl) ? PROD_GTM_ID : LOWER_ENV_GTM_ID;
}
