import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Header } from './components/Header';
import { useEnv } from './hooks/useEnv';
import { A11yPage } from './pages/a11y/A11yPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RunPage } from './pages/run/RunPage';
import { SuitePage } from './pages/suite/SuitePage';
import { SuitesPage } from './pages/SuitesPage';

// The header and the page for the current route.
export function App() {
  const { currentEnv } = useEnv();
  const { pathname } = useLocation();

  // Braces matter: scrollTo returns a Promise in current browsers, and an
  // effect may only return a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />
      {/* The key starts each page fresh (new state, new requests) when the
          route or the environment changes. */}
      <main id="view" tabIndex={-1} key={`${currentEnv.id}:${pathname}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/suites" replace />} />
          <Route path="/suites" element={<SuitesPage />} />
          <Route path="/suites/:slug" element={<SuitePage />} />
          <Route path="/a11y" element={<A11yPage />} />
          <Route path="/runs/:id" element={<RunPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  );
}
