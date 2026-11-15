import { useCallback, useEffect, useRef, useState } from 'react';
import { REP_PROFILES, RepCounter, type RepProfile } from '@/lib/repCounter';
import { isMotionAvailable, subscribeToMotion, type MotionSubscription } from '@/services/motion';

/**
 * Counts reps from the device accelerometer while `counting` is true.
 * `onRep` is called once per detected rep.
 */
export function useAutoRepCounter(onRep: () => void) {
  const [available, setAvailable] = useState(false);
  const [counting, setCounting] = useState(false);
  const subscription = useRef<MotionSubscription | null>(null);
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    let cancelled = false;
    isMotionAvailable().then((ok) => !cancelled && setAvailable(ok));
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    setCounting(false);
  }, []);

  const start = useCallback((profile: RepProfile) => {
    subscription.current?.remove();
    const counter = new RepCounter(REP_PROFILES[profile]);
    subscription.current = subscribeToMotion((sample) => {
      if (counter.push(sample)) onRepRef.current();
    });
    setCounting(true);
  }, []);

  // Stop listening when the component goes away.
  useEffect(() => () => subscription.current?.remove(), []);

  return { available, counting, start, stop };
}
