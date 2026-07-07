"use client";
import { CampaignTemplate, PALETTES } from "../_shared/CampaignTemplate";
export default function DaylightPreview() {
    return <CampaignTemplate T={PALETTES.daylight.tokens} paletteKey="daylight" />;
}
