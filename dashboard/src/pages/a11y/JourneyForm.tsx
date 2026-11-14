import { useState } from 'react';
import type { RolesResponse } from '../../api/types';
import { useApi } from '../../hooks/useApi';
import { useEnv } from '../../hooks/useEnv';
import { useStartRun } from '../../hooks/useStartRun';
import { RunRefused, useRunRefusal } from '../suite/RunRefused';

const EXAMPLE =
  'Search for nurse jobs in Saint Paul, open the first job, open its Share dialog and close it, then open the login dialog from Save search and close it.';

// A journey for Claude to follow, in plain words, as a visitor or a saved
// login, on desktop or a phone. The browser scans every page and dialog
// Claude reaches; Claude checks keyboard use and focus. Start begins a run
// and opens its page; a login that isn't ready stops it with the command to
// log in again.
export function JourneyForm() {
  const { currentEnv } = useEnv();
  const roles = useApi<RolesResponse>(`/api/roles?env=${currentEnv.id}`).data
    ?.roles;
  const [journey, setJourney] = useState('');
  const [role, setRole] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [busy, setBusy] = useState(false);
  const { refusal, onError, clear } = useRunRefusal();
  const start = useStartRun(onError);

  return (
    <form
      className="card journey-form"
      aria-labelledby="journey-heading"
      onSubmit={async (e) => {
        e.preventDefault();
        clear();
        setBusy(true);
        await start('/api/a11y/journeys', {
          journey,
          role: role || undefined,
          device,
        });
        setBusy(false);
      }}
    >
      <h2 id="journey-heading" className="journey-field-wide">
        Follow a journey with Claude
      </h2>
      <div className="journey-field journey-field-wide">
        <label htmlFor="journey-text">The journey</label>
        <textarea
          id="journey-text"
          required
          minLength={10}
          maxLength={4000}
          value={journey}
          onChange={(e) => setJourney(e.target.value)}
          placeholder={EXAMPLE}
          aria-describedby="journey-note"
        />
        <span id="journey-note" className="note small">
          What to do, in plain words: where to start, what to open, which
          dialogs and forms to try. No need to list pages. Claude submits
          nothing the journey doesn't ask for. Uses your Claude plan or API
          credits.
        </span>
      </div>
      <div className="journey-field">
        <label htmlFor="journey-role">Logged in as</label>
        <select
          id="journey-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Visitor (not logged in)</option>
          {roles?.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="journey-field">
        <label htmlFor="journey-device">Device</label>
        <select
          id="journey-device"
          value={device}
          onChange={(e) => setDevice(e.target.value as 'desktop' | 'mobile')}
        >
          <option value="desktop">Desktop</option>
          <option value="mobile">Phone</option>
        </select>
      </div>
      <div>
        <button type="submit" disabled={busy}>
          {busy ? 'Starting…' : `Start on ${currentEnv.name}`}
        </button>
      </div>
      {refusal && (
        <div className="journey-refused">
          <RunRefused refusal={refusal} />
        </div>
      )}
    </form>
  );
}
