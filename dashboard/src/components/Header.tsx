import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { useEnv } from '../hooks/useEnv';
import { envLabel } from '../lib/format';
import { LoginsMenu } from './LoginsMenu';
// The CareerForce site logo, copied from careerforce_skin/logo.svg. Bundled
// rather than linked, because the QA and Stage sites sit behind basic auth.
import logoUrl from '../assets/careerforce-logo.svg';

// The top bar: brand, page links, the environment picker, and the Login Sessions
// menu (the saved session of every role on that environment). Picking
// Production turns the bar red (body.env-production in styles.css).
export function Header() {
  const { environments, currentEnv, setCurrentEnv } = useEnv();

  useEffect(() => {
    document.body.classList.toggle('env-production', currentEnv.production);
  }, [currentEnv.production]);

  // The bar sticks to the top and wraps onto more lines when narrow, so
  // publish its height as --topbar-height for other sticky things to sit
  // below it.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--topbar-height', `${el.offsetHeight}px`);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="topbar" ref={ref}>
      <div className="brand">
        <img
          className="brand-logo"
          src={logoUrl}
          alt="CareerForce - Test Dashboard"
          width={303}
          height={73}
        />
      </div>
      <nav className="nav" aria-label="Dashboard sections">
        <NavLink to="/suites">Suites</NavLink>
        <LoginsMenu />
      </nav>
      <div className="env-picker">
        <label htmlFor="env-select">Environment</label>
        <select
          id="env-select"
          value={currentEnv.id}
          onChange={(e) => setCurrentEnv(e.target.value)}
        >
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {envLabel(e)}
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
