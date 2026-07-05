"use client";

import { useEffect } from "react";

// Sets the browser-tab title for "use client" pages that can't export
// Next.js `metadata`. Appends "| Ryan Malley" automatically.
// Pass null/undefined while data is still loading to avoid a flash of
// "undefined | Ryan Malley".
export function useDocumentTitle(title: string | null | undefined) {
    useEffect(() => {
        if (!title) return;
        const prev = document.title;
        document.title = `${title} | Ryan Malley`;
        return () => { document.title = prev; };
    }, [title]);
}
