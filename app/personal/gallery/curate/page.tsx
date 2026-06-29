"use client";

import { useMemo, useState } from "react";
import { Box, Button, Container, Tab, Tabs, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, BarChart3, Scissors } from "lucide-react";
import { pruningCandidates, suggestedTags, tagFrequency, useGalleryData } from "../_lib/useGalleryData";
import { TagFrequencyChart } from "../_components/TagFrequencyChart";
import { GalleryView } from "../_components/GalleryView";

const ACCENT = "#ec4899";

export default function CuratePage() {
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();
    const [tab, setTab] = useState(0);
    const [topN, setTopN] = useState(10);

    const frequency = useMemo(() => tagFrequency(photos), [photos]);
    const candidates = useMemo(() => pruningCandidates(photos, topN), [photos, topN]);
    const allTags = useMemo(() => suggestedTags(photos), [photos]);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="lg">
                <Button component={Link} href="/personal/gallery" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back to Gallery
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <BarChart3 size={32} color={ACCENT} />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                        Curate
                    </Typography>
                </Box>
                <Typography sx={{ color: "text.secondary", mb: 3 }}>
                    See which aesthetic tags are over- and underrepresented across {photos.length} photos,
                    and find redundant photos to prune.
                </Typography>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}
                    TabIndicatorProps={{ sx: { backgroundColor: ACCENT } }}>
                    <Tab label="Tag Frequency" sx={{ "&.Mui-selected": { color: ACCENT } }} />
                    <Tab label={`Pruning Candidates (${candidates.length})`} sx={{ "&.Mui-selected": { color: ACCENT } }} />
                </Tabs>

                {loading ? null : tab === 0 ? (
                    <TagFrequencyChart frequency={frequency} />
                ) : (
                    <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
                            <Typography sx={{ color: "text.secondary" }}>Top</Typography>
                            <TextField size="small" type="number" value={topN}
                                inputProps={{ min: 1, max: Math.max(1, frequency.length) }}
                                onChange={e => setTopN(Math.min(frequency.length, Math.max(1, Number(e.target.value) || 1)))}
                                sx={{ width: 80 }} />
                            <Typography sx={{ color: "text.secondary" }}>
                                most-used tags count as &quot;well represented.&quot;
                            </Typography>
                        </Box>
                        <Typography sx={{ color: "text.disabled", fontSize: "0.8rem", mb: 3 }}>
                            Showing photos where every tag falls within that top {topN} — nothing about them is rare,
                            so they&apos;re not adding much diversity. Sorted most-redundant first.
                        </Typography>

                        {candidates.length === 0 ? (
                            <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
                                No candidates at this threshold — try raising the number above.
                            </Typography>
                        ) : (
                            <GalleryView
                                icon={Scissors}
                                title="Pruning Candidates"
                                photos={candidates}
                                allTags={allTags}
                                subGalleries={subGalleries}
                                urls={urls}
                                loading={loading}
                                reload={reload}
                                emptyMessage="No candidates."
                            />
                        )}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
