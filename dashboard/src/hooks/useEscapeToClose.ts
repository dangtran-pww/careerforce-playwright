import { useEffect } from 'react';

// Closes a side panel on Escape, unless the Escape is for something on top
// of it: an open modal (<dialog>) or popover (the header's Login Sessions)
// closes itself on that key, and the panel stays. A handler that has dealt
// with the key itself can call preventDefault() to keep the panel open too.
//
//   useEscapeToClose(onClose);
//   useEscapeToClose(onClose, !showModal); // off while its own modal shows
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Still open here: the browser closes it after the key's listeners.
      if (document.querySelector('dialog[open], :popover-open')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}
