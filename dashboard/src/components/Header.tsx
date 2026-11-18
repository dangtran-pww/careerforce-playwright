import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router';
import { PRODUCTION_DISABLED, useEnv } from '../hooks/useEnv';
import { hostOf } from '../lib/format';
import { CaseSearch } from './CaseSearch';
import { LoginsMenu } from './LoginsMenu';
// The CareerForce site logo, copied from careerforce_skin/logo.svg. Bundled
// rather than linked, because the QA and Stage sites sit behind basic auth.
import logoUrl from '../assets/careerforce-logo.svg';

// The top bar: the brand (a link home), the page links, then the tools: the
// case search, the Login Sessions menu (the saved session of every role on
// that environment) and the environment picker. Only the page links are in
// the <nav> landmark. Picking Production turns the bar red
// (body.env-production in styles/env-picker.css).
export function Header() {
  const { environments, currentEnv, setCurrentEnv } = useEnv();

  useEffect(() => {
    document.body.classList.toggle('env-production', currentEnv.production);
  }, [currentEnv.production]);

  // The bar sticks to the top and wraps onto more lines when narrow, so
  // publish its height as --topbar-height for other sticky things to sit
  // below it. On a phone it scrolls away with the page (styles/topbar.css),
  // so it takes no room: 0.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      const sticky = getComputedStyle(el).position === 'sticky';
      root.style.setProperty(
        '--topbar-height',
        `${sticky ? el.offsetHeight : 0}px`,
      );
    };
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  return (
    <header className="topbar" ref={ref}>
      <Link className="brand" to="/suites">
        <img
          className="brand-logo"
          src={logoUrl}
          alt="CareerForce - Test Dashboard"
          width={303}
          height={73}
        />
      </Link>
      {/* .nav lays out the links and the tools as one group (topbar.css);
          the landmark is the links only. */}
      <div className="nav">
        <nav className="nav-links" aria-label="Dashboard sections">
          <NavLink to="/suites">Suites</NavLink>
          <NavLink to="/a11y">Accessibility Scan</NavLink>
        </nav>
        {/* Keyed so a new environment loads its own plans' cases. */}
        <CaseSearch key={currentEnv.id} />
        <LoginsMenu />
      </div>
      <div className="env-picker">
        <label htmlFor="env-select">Environment</label>
        {/* Names only, so the picker stays small: a <select> is as wide as
            its longest option. The site's address is in the tooltips. */}
        <select
          id="env-select"
          value={currentEnv.id}
          title={hostOf(currentEnv.baseURL)}
          onChange={(e) => setCurrentEnv(e.target.value)}
        >
          {environments.map((e) => (
            <option
              key={e.id}
              value={e.id}
              title={
                PRODUCTION_DISABLED && e.production
                  ? `${hostOf(e.baseURL)}: disabled for now`
                  : hostOf(e.baseURL)
              }
              disabled={PRODUCTION_DISABLED && e.production}
            >
              {e.name}
            </option>
          ))}
        </select>
        <span
          id="env-badge"
          className="badge badge-bad"
          hidden={!currentEnv.production}
        >
          Production
        </span>
      </div>
    </header>
  );
}
