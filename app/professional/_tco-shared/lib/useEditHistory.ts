"use client";

import { useRef, useState } from "react";

// Edits close together (typing a number, stepping an input) count as one
// change, so Undo goes back a whole edit, not one keystroke.
const GROUP_MS = 800;
const MAX_STEPS = 50;

// Undo for the results page's live edits. `edit` wraps each change handler:
// the first change after a pause records the state it started from. Done in
// the handlers rather than an effect watching the state, so it only ever
// records the user's own edits, never a load or an undo.
//
// `previous` is the state before the most recent change, which the page
// diffs against to show what that change did to each total.
export function useEditHistory<T>(current: T, restore: (state: T) => void) {
  const [stack, setStack] = useState<T[]>([]);
  const lastEditAt = useRef(0);

  function edit<A extends unknown[]>(handler: (...args: A) => void) {
    return (...args: A) => {
      const now = Date.now();
      if (now - lastEditAt.current > GROUP_MS) setStack((s) => [...s.slice(1 - MAX_STEPS), current]);
      lastEditAt.current = now;
      handler(...args);
    };
  }

  function undo() {
    const top = stack[stack.length - 1];
    if (top === undefined) return;
    setStack((s) => s.slice(0, -1));
    lastEditAt.current = 0;
    restore(top);
  }

  return { edit, undo, previous: stack.length ? stack[stack.length - 1] : null };
}
