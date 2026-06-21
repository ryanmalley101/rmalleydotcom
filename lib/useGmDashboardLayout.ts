"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export interface GmDashboardLayout {
    collapsedSections: string[];
    tableMode: boolean;
}

const DEFAULT_LAYOUT: GmDashboardLayout = { collapsedSections: [], tableMode: false };

function parseLayout(json: string | null | undefined): GmDashboardLayout {
    if (!json) return { ...DEFAULT_LAYOUT };
    try { return { ...DEFAULT_LAYOUT, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_LAYOUT }; }
}

// Persists which GM Dashboard sections are collapsed and whether "table mode"
// (high-contrast, for a shared screen) is on — backed by the same lazily-created
// UserPreference row the autosave-default setting uses.
export function useGmDashboardLayout() {
    const [layout, setLayoutState] = useState<GmDashboardLayout>({ ...DEFAULT_LAYOUT });
    const [prefId, setPrefId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        client.models.UserPreference.list().then(({ data }) => {
            const existing = data?.[0];
            if (existing) {
                setPrefId(existing.id);
                setLayoutState(parseLayout(existing.gmDashboardLayoutJson));
            }
            setLoaded(true);
        });
    }, []);

    const persist = useCallback(async (next: GmDashboardLayout) => {
        setLayoutState(next);
        if (prefId) {
            await client.models.UserPreference.update({ id: prefId, gmDashboardLayoutJson: JSON.stringify(next) });
        } else {
            const { data } = await client.models.UserPreference.create({ gmDashboardLayoutJson: JSON.stringify(next) });
            if (data) setPrefId(data.id);
        }
    }, [prefId]);

    const toggleSection = useCallback((key: string) => {
        setLayoutState(prev => {
            const collapsed = prev.collapsedSections.includes(key)
                ? prev.collapsedSections.filter(k => k !== key)
                : [...prev.collapsedSections, key];
            const next = { ...prev, collapsedSections: collapsed };
            persist(next);
            return next;
        });
    }, [persist]);

    const setTableMode = useCallback((tableMode: boolean) => {
        persist({ ...layout, tableMode });
    }, [layout, persist]);

    return { layout, layoutLoaded: loaded, toggleSection, setTableMode };
}
