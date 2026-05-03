import { useCallback, useEffect, useState } from 'react';
import { getDisplayName, getOnboardingCompleted } from '@/services/userProfile';

/**
 * Boot gate: wait until we know whether to send the user to onboarding or the main app.
 */
export function useOnboardingGate(): { ready: boolean; showOnboarding: boolean } {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const done = await getOnboardingCompleted();
        if (!cancelled) {
          setShowOnboarding(!done);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setShowOnboarding(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, showOnboarding };
}

/**
 * Live display name for greetings (optional refresh after onboarding).
 */
export function useDisplayName(): {
  displayName: string | null;
  refresh: () => Promise<void>;
} {
  const [displayName, setDisplayName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const n = await getDisplayName();
      setDisplayName(n);
    } catch {
      setDisplayName(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { displayName, refresh };
}
