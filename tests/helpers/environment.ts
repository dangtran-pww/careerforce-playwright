// GTM container ID differs by environment: one ID for prod, one shared across
// the lower environments (QA, stage, sandbox) per the source smoke-testing
// checklist. Confirmed by inspecting prod and QA directly; stage/sandbox are
// assumed to match QA until checked.
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
