"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Resolves whether the signed-in user is the GM of a campaign. There's no
// built-in way to ask this in this app — Campaign.create() never created a
// matching CampaignMember row for its own creator, and the auto-managed
// owner-auth field isn't something client code should rely on the exact
// format of. So this checks two explicit identity fields instead:
// Campaign.gmUserId (the creator) and CampaignMember.userId (anyone who
// joined via a 'gm'-role invite, e.g. a co-GM).
//
// Campaigns created before gmUserId existed have it unset — treated as
// permissive (isGm: true for everyone) rather than locking the real GM out
// of their own existing campaign.
export function useCampaignRole(campaignId: string) {
    const [role, setRole] = useState<"gm" | "player">("player");
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const user = await getCurrentUser();
                if (cancelled) return;
                setUserId(user.userId);

                const { data: campaign } = await client.models.Campaign.get({ id: campaignId });
                if (cancelled) return;

                if (!campaign?.gmUserId || campaign.gmUserId === user.userId) {
                    setRole("gm");
                    return;
                }

                const { data: members } = await client.models.CampaignMember.list({
                    filter: { campaignId: { eq: campaignId } },
                });
                if (cancelled) return;
                const mine = (members ?? []).find(m => m.userId === user.userId);
                setRole(mine?.role === "gm" ? "gm" : "player");
            } catch (err) {
                console.error("[useCampaignRole] failed to resolve role", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [campaignId]);

    return { role, userId, loading, isGm: role === "gm" };
}
