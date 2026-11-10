import { useEffect, useRef, useState } from 'react';

// A shell command with a Copy button. `small` shows the button as an icon,
// for tight spots such as an expanded test case.
export function Command({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className="command">
      <code>{text}</code>
      <CopyButton text={text} small={small} />
    </div>
  );
}

type CopyState = 'idle' | 'copied' | 'failed';

const LABEL: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed',
};

export function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  const label = LABEL[state];
  if (small)
    return (
      <button
        type="button"
        className="ghost icon-button"
        onClick={copy}
        aria-label={label}
        title={label}
      >
        <CopyIcon state={state} />
      </button>
    );
  return (
    <button type="button" className="ghost" onClick={copy}>
      {label}
    </button>
  );
}

// 16px stroke icons that follow the text colour: two sheets for Copy, a tick
// once copied, a cross when copying failed.
function CopyIcon({ state }: { state: CopyState }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {state === 'copied' ? (
        <path d="M20 6 9 17l-5-5" />
      ) : state === 'failed' ? (
        <path d="M18 6 6 18M6 6l12 12" />
      ) : (
        <>
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
    </svg>
  );
}
