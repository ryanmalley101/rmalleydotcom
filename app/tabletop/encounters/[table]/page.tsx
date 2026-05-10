import { notFound } from "next/navigation";
import { getAllTables, getTableBySlug } from "@/lib/encounterTables";
import EncounterTableContent from "./EncounterTableContent";

interface PageProps {
    params: Promise<{ table: string }>;
}

export async function generateStaticParams() {
    return getAllTables().map(t => ({ table: t.slug }));
}

export async function generateMetadata({ params }: PageProps) {
    const { table: slug } = await params;
    const table = getTableBySlug(slug);
    return { title: table ? `${table.name} Encounters` : "Not Found" };
}

export default async function EncounterTablePage({ params }: PageProps) {
    const { table: slug } = await params;
    const table = getTableBySlug(slug);

    if (!table) notFound();

    return <EncounterTableContent table={table} />;
}
