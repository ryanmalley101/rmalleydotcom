"use client";

import { useState } from "react";

// Returns true on the first render and on any render where one of `deps`
// differs (Object.is) from the previous render — the same timing as a
// `useEffect(..., deps)`, but usable *during render*.
//
// This is React's "adjusting state when a prop changes" pattern
// (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
//
//     if (useDepsChanged([open, item]) && open) {
//         setName(item?.name ?? "");
//     }
//
// Setting state inside that branch makes React re-render immediately, before
// the browser paints, instead of painting stale form values and then
// re-rendering from an effect.
export function useDepsChanged(deps: readonly unknown[]): boolean {
    const [prev, setPrev] = useState<readonly unknown[] | null>(null);
    const changed =
        prev === null ||
        prev.length !== deps.length ||
        deps.some((d, i) => !Object.is(d, prev[i]));
    if (changed) setPrev(deps);
    return changed;
}
