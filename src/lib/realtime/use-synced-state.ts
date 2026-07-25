"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Like useState(initial), but replaces local state whenever the server prop
 * updates (e.g. after router.refresh() from Realtime).
 *
 * Pass `enabled: false` to pause sync while the user has unsaved local edits.
 */
export function useSyncedState<T>(
  initial: T,
  enabled = true,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (!enabled) return;
    setState(initial);
  }, [initial, enabled]);

  return [state, setState];
}
