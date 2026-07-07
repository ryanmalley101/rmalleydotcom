"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function VerdantPreview() {
    return <CampaignTemplate T={PALETTES.verdant.tokens} paletteKey="verdant" />;
}
