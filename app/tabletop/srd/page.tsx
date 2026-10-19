import { Suspense } from "react";
import SrdSearchContent from "./SrdSearchContent";

export const metadata = { title: "5.5e SRD Reference" };

// The search state lives in the URL (useSearchParams), which needs a Suspense
// boundary for the page to still prerender.
export default function SrdPage() {
    return (
        <Suspense>
            <SrdSearchContent />
        </Suspense>
    );
}
