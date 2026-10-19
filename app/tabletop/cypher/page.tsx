import { Suspense } from "react";
import CypherSearchContent from "./CypherSearchContent";

export const metadata = { title: "Cypher System SRD" };

// The search state lives in the URL (useSearchParams), which needs a Suspense
// boundary for the page to still prerender.
export default function CypherPage() {
    return (
        <Suspense>
            <CypherSearchContent />
        </Suspense>
    );
}
