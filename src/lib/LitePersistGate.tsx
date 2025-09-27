import React, { useEffect, useState } from "react";

type Props = {
  persistor: any;
  children: React.ReactNode;
  /** Optional placeholder while restoring state */
  loading?: React.ReactNode;
};

/**
 * Minimal replacement for redux-persist's PersistGate.
 * Waits until persistor reports { bootstrapped: true } then renders children.
 */
export default function LitePersistGate({ persistor, children, loading = null }: Props) {
  const [ready, setReady] = useState<boolean>(() => {
    try {
      return !!persistor?.getState?.().bootstrapped;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!persistor?.subscribe || ready) return;

    const unsub = persistor.subscribe(() => {
      try {
        const state = persistor.getState?.();
        if (state?.bootstrapped) {
          setReady(true);
          unsub();
        }
      } catch {
        // ignore
      }
    });

    // in case it bootstrapped between render and subscribe
    try {
      if (persistor.getState?.().bootstrapped) {
        setReady(true);
        unsub();
      }
    } catch {/* ignore */}

    return () => { try { unsub(); } catch {/* ignore */} };
  }, [persistor, ready]);

  return <>{ready ? children : loading}</>;
}
