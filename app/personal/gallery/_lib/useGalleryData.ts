"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { AI_VISION_TAGS } from "@/lib/aestheticTags";

const client = generateClient<Schema>();

export type GalleryPhoto = Schema["GalleryPhoto"]["type"];
export type SubGallery = Schema["SubGallery"]["type"];

// list() only returns one page (100 items by default) — galleries with more
// than that would silently under-count and drop photos past the first page,
// so every caller needs the complete set, not just a page of it.
async function listAllPhotos(): Promise<GalleryPhoto[]> {
    const all: GalleryPhoto[] = [];
    let nextToken: string | null | undefined;
    do {
        const res = await client.models.GalleryPhoto.list({ limit: 1000, nextToken });
        all.push(...(res.data ?? []));
        nextToken = res.nextToken;
    } while (nextToken);
    return all;
}

async function listAllSubGalleries(): Promise<SubGallery[]> {
    const all: SubGallery[] = [];
    let nextToken: string | null | undefined;
    do {
        const res = await client.models.SubGallery.list({ limit: 1000, nextToken });
        all.push(...(res.data ?? []));
        nextToken = res.nextToken;
    } while (nextToken);
    return all;
}

// Shared by the master gallery and every sub-gallery page: lists both
// models and resolves a signed display URL for every photo's S3 key
// (mirrors the wiki gallery's getUrl-resolution pattern).
export function useGalleryData() {
    const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
    const [subGalleries, setSubGalleries] = useState<SubGallery[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        const [allPhotos, allGalleries] = await Promise.all([
            listAllPhotos(),
            listAllSubGalleries(),
        ]);
        const loadedPhotos = allPhotos.sort((a, b) =>
            (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")
        );
        setPhotos(loadedPhotos);
        setSubGalleries(allGalleries);

        const resolved: Record<string, string> = {};
        await Promise.all(loadedPhotos.map(async photo => {
            try {
                const { url } = await getUrl({ path: photo.storageKey, options: { expiresIn: 3600 } });
                resolved[photo.storageKey] = url.toString();
            } catch { /* skip unresolvable key */ }
        }));
        setUrls(resolved);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    return { photos, subGalleries, urls, loading, reload };
}

// Every distinct tag used across a set of photos, sorted — used to drive
// the freeform tag Autocomplete's suggestion list.
export function collectAllTags(photos: GalleryPhoto[]): string[] {
    const tags = new Set<string>();
    for (const photo of photos) {
        for (const tag of photo.tags ?? []) {
            if (tag) tags.add(tag);
        }
    }
    return Array.from(tags).sort();
}

// Autocomplete suggestions for the tag editor: the curated aesthetic
// vocabulary plus whatever freeform tags are already in use, so suggestions
// are useful even before any photo has been tagged.
export function suggestedTags(photos: GalleryPhoto[]): string[] {
    return Array.from(new Set([...AI_VISION_TAGS, ...collectAllTags(photos)])).sort();
}
