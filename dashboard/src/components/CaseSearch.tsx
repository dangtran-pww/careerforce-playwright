import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import type { PlansResponse } from '../api/types';
import { useEnv } from '../hooks/useEnv';
import {
  allCases,
  caseLink,
  findCases,
  type FoundCase,
} from '../lib/caseSearch';

// The top bar's "Find case" box: type a case ID (SS-1, or just SS) and pick
// a match to open that case on its suite page. The plans load the first time
// the box gets focus (the first load can take a few seconds).
export function CaseSearch() {
  const { currentEnv } = useEnv();
  const navigate = useNavigate();
  const [cases, setCases] = useState<FoundCase[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const loading = useRef(false);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  const load = () => {
    if (cases || loading.current) return;
    loading.current = true;
    setLoadError(null);
    api<PlansResponse>(`/api/plans?env=${currentEnv.id}`)
      .then((data) => setCases(allCases(data.plans)))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => (loading.current = false));
  };

  const matches = useMemo(
    () => (cases ? findCases(query, cases) : []),
    [cases, query],
  );
  const showList = open && query.trim() !== '';

  const go = (c: FoundCase) => {
    setQuery('');
    setOpen(false);
    navigate(caseLink(c));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (showList) e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!matches.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
    } else if (e.key === 'Enter' && showList && matches[active]) {
      e.preventDefault();
      go(matches[active]);
    }
  };

  return (
    <div className="case-search">
      <label htmlFor={`${listId}-input`} className="visually-hidden">
        Find a case by ID
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        placeholder="Find case, e.g. SS-1"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          showList && matches[active] ? optionId(active) : undefined
        }
        value={query}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching cases"
        className="case-search-list"
        hidden={!showList}
      >
        {loadError ? (
          <li className="case-search-note">Couldn't load cases: {loadError}</li>
        ) : !cases ? (
          <li className="case-search-note">Loading cases…</li>
        ) : !matches.length ? (
          <li className="case-search-note">No case with that ID</li>
        ) : (
          matches.map((c, i) => (
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className="case-search-option"
              // mousedown, not click: it fires before the input's blur
              // closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                go(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="mono strong">{c.id}</span> <span>{c.title}</span>
              <span className="note small case-search-plan">
                {c.planName}
                {c.prompt && ' · prompt case'}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
