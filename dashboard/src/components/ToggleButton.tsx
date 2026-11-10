import type { ReactNode } from 'react';

// A small centred "show more / show less" button with a chevron, for a
// section that folds open and closed. `controls` is the id of what it folds.
export function ToggleButton({
  open,
  controls,
  onToggle,
  children,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="ghost small toggle-button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      <Chevron up={open} />
      {children}
    </button>
  );
}

// A 14px chevron that follows the text colour: down to open, up to fold.
function Chevron({ up }: { up: boolean }) {
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
      <path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}
