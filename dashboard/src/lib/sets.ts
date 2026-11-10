// A copy of `set` with `key` added (on) or removed (off). React state must
// not be changed in place, so checkbox lists use this instead of add/delete.
export function toggled<T>(set: Set<T>, key: T, on: boolean): Set<T> {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}
