"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Like useState(initial), but replaces local state whenever the server prop
 * updates (e.g. after router.refresh() from Realtime).
 *
 * Pass `enabled: false` to pause sync while the user has unsaved local edits.
 * Re-enabling alone does NOT wipe local state — only a new `initial` value does.
 * That way closing a modal after an optimistic create/update keeps the new row.
 */
export function useSyncedState<T>(
  initial: T,
  enabled = true,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initial);
  const prevInitialRef = useRef(initial);

  useEffect(() => {
    const initialChanged = !Object.is(prevInitialRef.current, initial);
    if (initialChanged) {
      prevInitialRef.current = initial;
    }

    // Only apply server props when they actually change and sync is allowed.
    // Do not reset when `enabled` flips true (e.g. modal close after local save).
    if (!enabled || !initialChanged) return;
    setState(initial);
  }, [initial, enabled]);

  return [state, setState];
}
