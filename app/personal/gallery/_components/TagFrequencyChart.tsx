"use client";

import { Box, Typography } from "@mui/material";
import type { TagFrequencyEntry } from "../_lib/useGalleryData";

interface TagFrequencyChartProps {
    frequency: TagFrequencyEntry[];
}

const CATEGORY_COLORS: Record<string, string> = {
    "Global Scene & Layout": "#818cf8",
    "Design Archetype": "#f59e0b",
    "Lighting & Luminosity": "#facc15",
    "Color Profile": "#fb7185",
    "Surface Textures": "#34d399",
    "Material Markers": "#60a5fa",
};
const FREEFORM_COLOR = "#94a3b8";

export function TagFrequencyChart({ frequency }: TagFrequencyChartProps) {
    const maxCount = frequency.reduce((m, f) => Math.max(m, f.count), 0) || 1;
    const usedCount = frequency.filter(f => f.count > 0).length;
    const unusedCount = frequency.length - usedCount;

    return (
        <Box>
            <Typography sx={{ color: "text.secondary", mb: 1.5, fontSize: "0.85rem" }}>
                {usedCount} of {frequency.length} tags in use
                {unusedCount > 0 ? ` · ${unusedCount} never used yet (shown at zero, most underrepresented)` : ""}
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2.5 }}>
                {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
                    <Box key={category} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "2px", backgroundColor: color }} />
                        <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>{category}</Typography>
                    </Box>
                ))}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "2px", backgroundColor: FREEFORM_COLOR }} />
                    <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>Freeform / custom</Typography>
                </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {frequency.map(({ tag, count, category }) => (
                    <Box key={tag} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Typography sx={{
                            width: 170, flexShrink: 0, fontSize: "0.8rem",
                            color: count === 0 ? "text.disabled" : "text.primary",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={tag}>
                            {tag}
                        </Typography>
                        <Box sx={{
                            flex: 1, position: "relative", height: 18,
                            backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 1,
                        }}>
                            <Box sx={{
                                position: "absolute", top: 0, left: 0, height: "100%",
                                width: `${(count / maxCount) * 100}%`,
                                minWidth: count > 0 ? 3 : 0,
                                backgroundColor: category ? (CATEGORY_COLORS[category] ?? FREEFORM_COLOR) : FREEFORM_COLOR,
                                borderRadius: 1,
                                transition: "width 0.2s",
                            }} />
                        </Box>
                        <Typography sx={{ width: 36, textAlign: "right", fontSize: "0.78rem", color: "text.secondary" }}>
                            {count}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
