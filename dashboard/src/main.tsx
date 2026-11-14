// Test dashboard: a React app served by dashboard/server/index.mjs, which
// also answers the /api/* calls it makes.
//
//   npm run dashboard        builds this app (Vite) and serves it
//   npm run dashboard:dev    serves it straight from src/ and reloads the
//                            page as you edit
//
//   main.tsx          start-up: router, environment and logins providers
//   App.tsx           header and routes (URL → page)
//   pages/            one component per page; a page with several parts has
//                     its own folder (suite/, run/)
//   components/       pieces the pages share (Table, Facts, Badge,
//                     SessionCard, RunsTable, TestResults, SuiteSteps…)
//   hooks/            useApi (load data), useEnv (current environment),
//                     useLogins (the header's Login Sessions panel),
//                     useStartRun, useRerun (run again from a run page),
//                     useEscapeToClose (side panels), useTick
//   api/              fetch helpers and the types of every API answer
//   lib/              plain functions: formatting, status labels, run facts
//   styles.css        imports styles/*.css in cascade order
//
// To add a page: write pages/<Name>Page.tsx, add a <Route> in App.tsx, and a
// <NavLink> in components/Header.tsx if it belongs in the top bar.
//
// Routes are hash routes (#/suites/<slug>), because the server answers
// /runs/<id>/... itself with each run's report files.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App';
import { EnvProvider } from './hooks/useEnv';
import { LoginsProvider } from './hooks/useLogins';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <EnvProvider>
        <LoginsProvider>
          <App />
        </LoginsProvider>
      </EnvProvider>
    </HashRouter>
  </StrictMode>,
);
