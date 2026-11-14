// How the plan panel's Run buttons run: the suite page's choices (headed,
// accessibility scan), the suite's projects for the plan, whether another
// run is going, and where a refused start is reported. <PlanPanel> provides
// them once; every Run button inside it reads them with useRunOptions(),
// rather than each layer passing them on as props.

import { createContext, useContext } from 'react';

export interface RunOptions {
  suite: string; // the suite page it's on; runs started here link back
  projects: string[]; // the suite's projects for this plan; [] = the plan's own
  headed: boolean;
  a11y: boolean; // scan the pages for accessibility
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
    a11y: options.a11y,
    suite: options.suite,
  };
}
