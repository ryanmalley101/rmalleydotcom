"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function GildedPreview() {
    return <CampaignTemplate T={PALETTES.gilded.tokens} paletteKey="gilded" />;
}
