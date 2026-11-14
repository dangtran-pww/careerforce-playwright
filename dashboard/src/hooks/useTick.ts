import { useEffect, useState } from 'react';

// Re-renders the component every `ms` while `enabled`, for text that reads
// the clock ("running for 1m 12s").
export function useTick(ms: number, enabled = true) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms, enabled]);
}
