"use client";

import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 1023;

export function useMobileOrderEntry(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function evaluate() {
      const narrow = window.matchMedia(
        `(max-width: ${MOBILE_MAX_WIDTH}px)`,
      ).matches;
      const standalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      setIsMobile(narrow || standalone);
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

  return isMobile;
}

export function isMobileOrderEntry(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
