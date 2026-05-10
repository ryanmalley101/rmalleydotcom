import { getAllTables } from "@/lib/encounterTables";
import TabletopContent from "./TabletopContent";

export default function TabletopPage() {
    const encounterTables = getAllTables();
    return <TabletopContent encounterTables={encounterTables} />;
}
