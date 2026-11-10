import { useEffect, useState } from "react";

/** Live result of a CSS media query. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return on;
}

/** Screens too small to show the 3D view and the layer plan side by side (a phone in either orientation). */
export const SMALL_SCREEN = "(max-width: 600px), (orientation: landscape) and (max-height: 520px)";
