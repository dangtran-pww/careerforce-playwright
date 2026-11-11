// Child processes the dashboard starts: test runs, Claude, UI mode.

/**
 * End a process started with `detached: true` and everything it started
 * (browsers, MCP servers): it leads its own process group. Falls back to the
 * process alone if the group is already gone.
 */
export function killGroup(child, signal = 'SIGTERM') {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

/** A command argument as it would be typed in a shell, for showing it. */
export const quote = (arg) =>
  /^[\w./=:@-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
