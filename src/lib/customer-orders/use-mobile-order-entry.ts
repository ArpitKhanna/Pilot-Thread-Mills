"use client";

import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 1023;

export type MobileOrderEntryState = {
  isMobile: boolean;
  /** False until the client has read matchMedia (avoids redirect flash/loops). */
  isReady: boolean;
};

export function useMobileOrderEntry(): MobileOrderEntryState {
  const [state, setState] = useState<MobileOrderEntryState>({
    isMobile: false,
    isReady: false,
  });

  useEffect(() => {
    function evaluate() {
      setState({ isMobile: isMobileOrderEntry(), isReady: true });
    }

    evaluate();

    const widthQuery = window.matchMedia(
      `(max-width: ${MOBILE_MAX_WIDTH}px)`,
    );
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    widthQuery.addEventListener("change", evaluate);
    standaloneQuery.addEventListener("change", evaluate);
    return () => {
      widthQuery.removeEventListener("change", evaluate);
      standaloneQuery.removeEventListener("change", evaluate);
    };
  }, []);

  return state;
}

export function isMobileOrderEntry(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
