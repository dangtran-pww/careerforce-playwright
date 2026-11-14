import { useState, type ComponentProps } from 'react';

type Props = Omit<ComponentProps<'button'>, 'onClick'> & {
  onClick: () => Promise<unknown>;
  busyLabel?: string; // shown while onClick runs
  confirmMessage?: string; // ask first; do nothing if the user says no
};

// A button that runs an async action and is disabled until it finishes.
// When the action throws, its message shows beside the button until the
// next press, so a caller can let a failed request's error through rather
// than alert() it.
export function AsyncButton({
  onClick,
  busyLabel = 'Starting…',
  confirmMessage,
  disabled,
  children,
  ...props
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    try {
      await onClick();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        {...props}
        disabled={disabled || busy}
        onClick={handleClick}
      >
        {busy ? busyLabel : children}
      </button>
      {error && (
        <span className="async-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
