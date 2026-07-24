import type { Metadata } from "next";
import ProfessionalThemeClient from "./ProfessionalThemeClient";

export const metadata: Metadata = {
    title: "Professional | Ryan Malley",
    description: "Tools built for Ryan Malley's day job, including a video surveillance TCO calculator.",
    // Not secret, just not meant to show up in search results or get crawled/indexed.
    robots: { index: false, follow: false },
};

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) {
    return <ProfessionalThemeClient>{children}</ProfessionalThemeClient>;
}
