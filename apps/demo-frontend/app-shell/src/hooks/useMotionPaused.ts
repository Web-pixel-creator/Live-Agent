import { useEffect, useState } from "react";

/**
 * useMotionPaused — tiny global store for the "pause backdrop animation"
 * toggle. Persisted to localStorage so the operator's preference sticks
 * across reloads. Also auto-honors prefers-reduced-motion as the initial
 * value (the user can still override either way).
 */
const KEY = "motion:paused";
const listeners = new Set<(v: boolean) => void>();
let current: boolean | null = null;

const read = (): boolean => {
  if (typeof window === "undefined") return false;
  if (current !== null) return current;
  const stored = localStorage.getItem(KEY);
  if (stored !== null) {
    current = stored === "1";
  } else {
    current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return current;
};

export const setMotionPaused = (v: boolean) => {
  current = v;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, v ? "1" : "0");
  }
  listeners.forEach((fn) => fn(v));
};

export const useMotionPaused = (): [boolean, (v: boolean) => void] => {
  const [val, setVal] = useState<boolean>(() => read());
  useEffect(() => {
    listeners.add(setVal);
    return () => {
      listeners.delete(setVal);
    };
  }, []);
  return [val, setMotionPaused];
};
