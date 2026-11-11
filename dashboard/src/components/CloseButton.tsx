import type { ComponentPropsWithoutRef } from 'react';

// The close button for panels and popovers: an X icon, never the word
// "Close". `label` names what it closes, for screen readers. Other props
// (onClick, popoverTarget, …) go to the button.
export function CloseButton({
  label,
  ...props
}: { label: string } & Omit<
  ComponentPropsWithoutRef<'button'>,
  'children' | 'type'
>) {
  return (
    <button
      type="button"
      className="ghost close-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
