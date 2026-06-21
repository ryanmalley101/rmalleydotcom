import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Routine saves (especially autosave, which fires every few seconds while
// typing) shouldn't snapshot every keystroke — only keep one revision per
// window unless a restore forces it.
const MIN_INTERVAL_MS = 5 * 60 * 1000;

interface SnapshottableArticle {
    id: string;
    title: string;
    content?: string | null;
    excerpt?: string | null;
}

// Snapshots the article's *current* (pre-edit) content before it gets
// overwritten. Call this with the in-memory article state right before
// applying an update.
export async function snapshotRevision(article: SnapshottableArticle, force = false): Promise<void> {
    if (!force) {
        const { data } = await client.models.WikiArticleRevision.list({ filter: { articleId: { eq: article.id } } });
        const latestSavedAt = (data ?? []).reduce<string | null>((latest, r) =>
            r.savedAt && (!latest || r.savedAt > latest) ? r.savedAt : latest, null);
        if (latestSavedAt && Date.now() - new Date(latestSavedAt).getTime() < MIN_INTERVAL_MS) return;
    }
    await client.models.WikiArticleRevision.create({
        articleId: article.id,
        title: article.title,
        content: article.content ?? undefined,
        excerpt: article.excerpt ?? undefined,
        savedAt: new Date().toISOString(),
    });
}
