import { useState, type ComponentProps } from 'react';

type Props = Omit<ComponentProps<'button'>, 'onClick'> & {
  onClick: () => Promise<unknown>;
  busyLabel?: string; // shown while onClick runs
  confirmMessage?: string; // ask first; do nothing if the user says no
};

// A button that runs an async action and is disabled until it finishes.
export function AsyncButton({
  onClick,
  busyLabel = 'Starting…',
  confirmMessage,
  disabled,
  children,
  ...props
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      onClick={handleClick}
    >
      {busy ? busyLabel : children}
    </button>
  );
}
