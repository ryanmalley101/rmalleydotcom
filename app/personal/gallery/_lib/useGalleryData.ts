"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export type GalleryPhoto = Schema["GalleryPhoto"]["type"];
export type SubGallery = Schema["SubGallery"]["type"];

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
        const [photosRes, galleriesRes] = await Promise.all([
            client.models.GalleryPhoto.list(),
            client.models.SubGallery.list(),
        ]);
        const loadedPhotos = (photosRes.data ?? []).sort((a, b) =>
            (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")
        );
        setPhotos(loadedPhotos);
        setSubGalleries(galleriesRes.data ?? []);

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
