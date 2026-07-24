import type { Metadata } from "next";
import { getAllTables } from "@/lib/encounterTables";
import TabletopContent from "./TabletopContent";

export const metadata: Metadata = { title: "Tabletop" };

export default function TabletopPage() {
    const encounterTables = getAllTables();
    return <TabletopContent encounterTables={encounterTables} />;
}
