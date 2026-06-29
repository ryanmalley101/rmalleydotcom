"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { AI_VISION_TAG_CATEGORIES, AI_VISION_TAGS } from "@/lib/aestheticTags";

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

export interface TagFrequencyEntry {
    tag: string;
    count: number;
    category: string | null; // null = freeform tag, not part of the curated vocabulary
}

const TAG_TO_CATEGORY = new Map<string, string>(
    Object.entries(AI_VISION_TAG_CATEGORIES).flatMap(([category, tags]) =>
        tags.map(tag => [tag, category] as const)
    )
);

// Usage count for every tag, sorted most- to least-used — seeded with the
// full curated vocabulary (at 0) so never-used tags show up as visibly
// underrepresented rather than just being absent from the list.
export function tagFrequency(photos: GalleryPhoto[]): TagFrequencyEntry[] {
    const counts = new Map<string, number>();
    for (const tag of AI_VISION_TAGS) counts.set(tag, 0);
    for (const photo of photos) {
        for (const tag of photo.tags ?? []) {
            if (!tag) continue;
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .map(([tag, count]) => ({ tag, count, category: TAG_TO_CATEGORY.get(tag) ?? null }))
        .sort((a, b) => b.count - a.count);
}

// Photos whose every tag falls within the `topN` most-used tags overall —
// i.e. nothing about them is rare, so they're not adding much diversity to
// the set. Ranked by a redundancy score (sum of each tag's global usage
// count) so the most over-represented photos surface first.
export function pruningCandidates(photos: GalleryPhoto[], topN: number): GalleryPhoto[] {
    const frequency = tagFrequency(photos);
    const countByTag = new Map(frequency.map(f => [f.tag, f.count]));
    const wellRepresented = new Set(
        frequency.filter(f => f.count > 0).slice(0, topN).map(f => f.tag)
    );

    return photos
        .map(photo => {
            const tags = (photo.tags ?? []).filter((t): t is string => !!t);
            return { photo, tags };
        })
        .filter(({ tags }) => tags.length > 0 && tags.every(t => wellRepresented.has(t)))
        .map(({ photo, tags }) => ({
            photo,
            score: tags.reduce((sum, t) => sum + (countByTag.get(t) ?? 0), 0),
        }))
        .sort((a, b) => b.score - a.score)
        .map(({ photo }) => photo);
}
