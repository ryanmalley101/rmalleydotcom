import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Finds the NPC join record linking this campaign to this wiki article,
// creating one (alive, no relationship/notes yet) if it doesn't exist yet.
// Cheap to call repeatedly — only ever creates once per (campaignId, articleId).
export async function ensureNpcLink(campaignId: string, articleId: string): Promise<string> {
    const { data } = await client.models.NPC.list({
        filter: { campaignId: { eq: campaignId }, articleId: { eq: articleId } },
    });
    const existing = data?.[0];
    if (existing) return existing.id;
    const { data: created } = await client.models.NPC.create({ campaignId, articleId, isAlive: true });
    return created!.id;
}
