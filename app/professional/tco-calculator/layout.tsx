import type { Metadata } from "next";
import MantineThemeClient from "./MantineThemeClient";

export const metadata: Metadata = {
    title: "Video Surveillance TCO Calculator | Ryan Malley",
    description:
        "Compare total cost of ownership for video surveillance deployments: cloud vs. on-prem, or either against itself. An independent estimate tool, not affiliated with or endorsed by any vendor it names.",
};

export default function TcoCalculatorLayout({ children }: { children: React.ReactNode }) {
    return <MantineThemeClient>{children}</MantineThemeClient>;
}
