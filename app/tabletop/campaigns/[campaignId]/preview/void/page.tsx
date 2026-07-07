"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function VoidPreview() {
    return <CampaignTemplate T={PALETTES.void.tokens} paletteKey="void" />;
}
