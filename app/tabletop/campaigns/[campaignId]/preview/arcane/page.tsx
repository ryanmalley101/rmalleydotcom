"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function ArcanePreview() {
    return <CampaignTemplate T={PALETTES.arcane.tokens} paletteKey="arcane" />;
}
