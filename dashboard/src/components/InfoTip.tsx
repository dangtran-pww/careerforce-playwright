import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// A small round "i" button that shows a short explanation in a bubble: a
// toggletip, so it works with a click, a tap or the keyboard, not only on
// hover. A second click, Escape or a click elsewhere closes it. `label`
// names the button for screen readers, e.g. "How the review works".
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bubbleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="info-tip" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="ghost info-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">i</span>
      </button>
      <div id={bubbleId} className="info-tip-bubble" role="note" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
