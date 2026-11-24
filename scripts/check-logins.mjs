// Checks that saved login sessions still work, before a test run needs them.
// It asks the site the same way the dashboard's Logins menu does (no browser,
// so no visit counts in the site's analytics).
//
// Run: npm run check:logins -- <role> [<role> ...] [--env qa|stage|prod|sandbox|local]
//      (env defaults to the one BASE_URL points at)
// e.g. npm run check:logins -- jobseeker admin
//
// Prints one line per role and exits 1 if any session isn't valid, with the
// login:manual command to fix it.
import { checkSessionOnce } from '../dashboard/server/sessions.mjs';
import { defaultEnv, environmentById } from './lib/site.mjs';

const args = process.argv.slice(2);
let env = defaultEnv;
const roles = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env') {
    env = environmentById(args[++i]);
    if (!env) {
      console.error(`Unknown environment: ${args[i]}`);
      process.exit(2);
    }
  } else {
    roles.push(args[i]);
  }
}
if (roles.length === 0) {
  console.error(
    'Usage: npm run check:logins -- <role> [<role> ...] [--env <env>]',
  );
  process.exit(2);
}

let failed = false;
for (const role of roles) {
  const r = await checkSessionOnce(role, env);
  const ok = r.status === 'valid';
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${role} on ${env.id}: ${r.status}. ${r.message ?? ''}` +
      (ok ? '' : `\n     Fix: ${r.loginCommand}`),
  );
}
process.exit(failed ? 1 : 0);
