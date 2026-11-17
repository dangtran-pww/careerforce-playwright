// How the plan panel's Run buttons run: whether the browser shows (headed),
// the suite's projects for the plan, whether another
// run is going, and where a refused start is reported. <PlanPanel> provides
// them once; every Run button inside it reads them with useRunOptions(),
// rather than each layer passing them on as props.

import { createContext, useContext } from 'react';

export interface RunOptions {
  suite: string; // the suite page it's on; runs started here link back
  projects: string[]; // the suite's projects for this plan; [] = the plan's own
  headed: boolean; // show the browser while the tests run
  setHeaded: (on: boolean) => void;
  activeRun: string | null;
  onRunError?: (err: Error) => void; // a Run press the server refused
}

export const RunOptionsContext = createContext<RunOptions | null>(null);

export function useRunOptions(): RunOptions {
  const options = useContext(RunOptionsContext);
  if (!options)
    throw new Error('useRunOptions() must be used inside <PlanPanel>');
  return options;
}

// The body of a run request for these options: `cases` of the plan, or all
// of them when left out.
export function runBody(options: RunOptions, cases?: string[]) {
  return {
    projects: options.projects.length ? options.projects : undefined,
    cases,
    headed: options.headed,
    suite: options.suite,
  };
}

// The "Show the browser" tick beside the panel's button that runs its test
// cases. It applies to every test run started from the panel.
export function HeadedOption() {
  const { headed, setHeaded } = useRunOptions();
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={headed}
        onChange={(e) => setHeaded(e.target.checked)}
      />
      <span>Show the browser while the tests run</span>
    </label>
  );
}
