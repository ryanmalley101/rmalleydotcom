"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Per-user default for "should autosave be on when I open an editor". Backed by
// a lazily-created UserPreference row (one per Cognito user, via owner auth).
export function useAutosaveDefault() {
    const [autosaveDefault, setAutosaveDefaultState] = useState(true);
    const [prefId, setPrefId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        client.models.UserPreference.list().then(({ data }) => {
            const existing = data?.[0];
            if (existing) {
                setPrefId(existing.id);
                setAutosaveDefaultState(existing.autosaveEnabled ?? true);
            }
            setLoaded(true);
        });
    }, []);

    const setAutosaveDefault = useCallback(async (enabled: boolean) => {
        setAutosaveDefaultState(enabled);
        if (prefId) {
            await client.models.UserPreference.update({ id: prefId, autosaveEnabled: enabled });
        } else {
            const { data } = await client.models.UserPreference.create({ autosaveEnabled: enabled });
            if (data) setPrefId(data.id);
        }
    }, [prefId]);

    return { autosaveDefault, autosaveDefaultLoaded: loaded, setAutosaveDefault };
}
