// A plan case's test code, for the questions asked about it (explain.mjs,
// review.mjs).

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ApiError } from '../errors.mjs';

/** The case, if it is in the plan and has tests to look at. */
export function findCase(plan, id) {
  const testCase = plan.cases.find((c) => c.id === id);
  if (!testCase) throw new ApiError(404, `${id} is not a case of this plan.`);
  if (!testCase.locations?.length)
    throw new ApiError(400, `${id} has no tests to explain yet.`);
  return testCase;
}

/**
 * A short hash of the files' names and contents: an answer about a case is
 * stale once it changes.
 */
export async function hashFiles(files) {
  const h = createHash('sha256');
  for (const f of [...files].sort())
    h.update(f).update(await readFile(f, 'utf8').catch(() => ''));
  return h.digest('hex').slice(0, 16);
}

/**
 * What a prompt about a case says about it: where its code is (`where`),
 * and the case's row in the plan (`planRow`).
 */
export function caseContext(testCase) {
  return {
    where: testCase.locations
      .map((l) => `- ${l.file}:${l.line} — "${l.title}"`)
      .join('\n'),
    planRow:
      testCase.details.map((d) => `${d.label}: ${d.text}`).join('\n') ||
      '(no more detail in the plan)',
  };
}
