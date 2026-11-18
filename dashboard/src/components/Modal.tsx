import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseButton } from './CloseButton';

// A modal dialog on the native <dialog>: the browser keeps focus inside it,
// dims the page behind it, and closes it on Escape. Render it only while it
// is open; `onClose` runs however it closes (Escape, the close button, or a
// click on the backdrop). `actions` go in the title bar, before the close
// button.
export function Modal({
  title,
  actions,
  onClose,
  className,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  // No close() on unmount: leaving the DOM ends the modal anyway, and
  // close() would fire onClose (React's dev double-mount would then shut it
  // straight away).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // The browser focuses the first control, which may be one of `actions`;
    // start on the close button instead, as before there were any.
    dialog.querySelector<HTMLElement>('.modal-head .close-button')?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={['modal card', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      onClose={onClose}
      // A click on the dialog itself, not its content, is on the backdrop.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <div className="modal-inner">
        <div className="card-head modal-head">
          <h2 id={headingId}>{title}</h2>
          <div className="card-head-actions">
            {actions}
            <CloseButton label="Close" onClick={() => ref.current?.close()} />
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}
