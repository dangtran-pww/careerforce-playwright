/**
 * One job per key at a time: while a job for `key` is running, asking for
 * the same key again joins it instead of starting another. Used where a
 * second click, or a page polling, would otherwise repeat slow work (asking
 * Claude, checking a login on the site).
 *
 *   const flights = singleFlight();
 *   flights.run(key, () => slowWork());   // a promise, shared per key
 *   flights.has(key);                     // is one running now?
 */
export function singleFlight() {
  const pending = new Map();
  return {
    run(key, job) {
      if (!pending.has(key))
        pending.set(
          key,
          // new Promise: a job that throws before its first await still
          // ends up as a rejection, and is removed like any other.
          new Promise((resolve) => resolve(job())).finally(() =>
            pending.delete(key),
          ),
        );
      return pending.get(key);
    },
    has: (key) => pending.has(key),
  };
}
