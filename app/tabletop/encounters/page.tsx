import { getAllTables } from "@/lib/encounterTables";
import EncountersContent from "./EncountersContent";

export default function EncountersIndexPage() {
    const tables = getAllTables();
    return <EncountersContent tables={tables} />;
}
