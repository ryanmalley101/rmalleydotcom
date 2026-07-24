"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function UnderdarkPreview() {
    return <CampaignTemplate T={PALETTES.underdark.tokens} paletteKey="underdark" />;
}
