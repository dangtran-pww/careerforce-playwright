import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// The gap kept between the bubble and the window's edges.
const EDGE = 16;

// The left and right edges a bubble must stay inside: the content edges
// (inside the padding) of the nearest container that clips what overflows
// it, e.g. a side panel that scrolls, so a bubble that has to move lines up
// with that container's text. With no such container, the window's edges.
function bounds(el: HTMLElement) {
  for (let a = el.parentElement; a; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === 'visible') continue;
    const r = a.getBoundingClientRect();
    return {
      left:
        r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      right:
        r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
    };
  }
  return { left: EDGE, right: document.documentElement.clientWidth - EDGE };
}

// A small round "i" button that shows a short explanation in a bubble: a
// toggletip, so it works with a click, a tap or the keyboard, not only on
// hover. A second click, Escape or a click elsewhere closes it. `label`
// names the button for screen readers, e.g. "How the review works".
// `align` picks which edge of the button the bubble lines up with: "end"
// (the default) opens it towards the left, "start" towards the right, for a
// button near the left edge of its container. A bubble that would be cut
// off (by the window or a panel that clips it) is narrowed if need be and
// moved to line up with that area's other edge instead. A small arrow on
// its top edge always points at the button.
export function InfoTip({
  label,
  align = 'end',
  children,
}: {
  label: string;
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bubbleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Measure before paint, so the bubble never shows cut off. Its styles
  // are set here directly, from scratch on each measure.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!open || !bubble) return;
    function fit() {
      const b = bubble!;
      b.style.translate = '';
      b.style.maxWidth = '';
      const area = bounds(b);
      const room = area.right - area.left;
      if (b.getBoundingClientRect().width > room)
        b.style.maxWidth = `${room}px`;
      const { left, right } = b.getBoundingClientRect();
      // Too far right: line its left edge up with the area's. Too far left:
      // line its right edge up with the area's.
      const dx =
        right > area.right
          ? area.left - left
          : left < area.left
            ? area.right - right
            : 0;
      if (dx) b.style.translate = `${dx}px 0`;
      const button = buttonRef.current!.getBoundingClientRect();
      const arrow = button.left + button.width / 2 - (left + dx);
      b.style.setProperty('--arrow-x', `${arrow}px`);
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open]);

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
      <div
        id={bubbleId}
        ref={bubbleRef}
        className={`info-tip-bubble info-tip-bubble-${align}`}
        role="note"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
