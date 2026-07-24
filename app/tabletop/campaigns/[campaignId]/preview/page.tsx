"use client";
import { CampaignTemplate, PALETTES } from "./_shared/CampaignTemplate";
export default function EmberPreview() {
    return <CampaignTemplate T={PALETTES.ember.tokens} paletteKey="ember" />;
}
