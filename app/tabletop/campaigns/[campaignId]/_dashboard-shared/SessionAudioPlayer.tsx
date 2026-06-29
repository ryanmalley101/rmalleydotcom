"use client";

import { useRef } from "react";
import { Box, Typography, IconButton, Slider, Tooltip, Select, MenuItem, FormControl, CircularProgress } from "@mui/material";
import { Play, Pause, Repeat, Upload, Trash2, Volume2, VolumeX, Music } from "lucide-react";
import { useSessionPlayback } from "@/lib/useSessionPlayback";

interface SessionAudioPlayerProps {
    campaignId: string;
    displayName: string;
    // player-view ("cast to a shared screen") routes always pass false,
    // regardless of who's actually looking at them — see the design note
    // this came from. Main dashboards and the VTT pass the GM-role check.
    controlsEnabled: boolean;
}

export function SessionAudioPlayer({ campaignId, displayName, controlsEnabled }: SessionAudioPlayerProps) {
    const {
        audioRef, audioUrl, tracks, activeTrack, playback,
        unlocked, uploading, masterVolume, setMasterVolume,
        playTrack, togglePause, setLoop, setGmVolume, uploadTrack, deleteTrack,
    } = useSessionPlayback(campaignId, displayName);
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, p: 1, minWidth: 240 }}>
            {/* Real but invisible — the hook drives this via audioRef */}
            <audio ref={audioRef} src={audioUrl} loop={false} hidden />

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Music size={14} />
                <Typography variant="caption" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeTrack ? activeTrack.name : "No track playing"}
                </Typography>
            </Box>

            {!unlocked && (
                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                    🔇 Click anywhere to enable session audio
                </Typography>
            )}

            {controlsEnabled && (
                <>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Tooltip title={playback?.paused === false ? "Pause" : "Play"}>
                            <span>
                                <IconButton size="small" disabled={!activeTrack} onClick={togglePause}>
                                    {playback?.paused === false ? <Pause size={16} /> : <Play size={16} />}
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Loop">
                            <IconButton size="small" onClick={() => setLoop(!playback?.loop)}
                                sx={{ color: playback?.loop ? "primary.main" : "text.disabled" }}>
                                <Repeat size={16} />
                            </IconButton>
                        </Tooltip>
                        <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                            <Select size="small" value={activeTrack?.id ?? ""} displayEmpty
                                onChange={e => e.target.value && playTrack(e.target.value)}
                                renderValue={v => tracks.find(t => t.id === v)?.name ?? "Pick a track…"}>
                                {tracks.map(t => (
                                    <MenuItem key={t.id} value={t.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                                        <span>{t.name}</span>
                                        <IconButton size="small" onClick={e => { e.stopPropagation(); deleteTrack(t.id); }}>
                                            <Trash2 size={12} />
                                        </IconButton>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <input ref={fileInputRef} type="file" accept="audio/*" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadTrack(f); e.target.value = ""; }} />
                        <Tooltip title="Upload track">
                            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <CircularProgress size={14} /> : <Upload size={14} />}
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", width: 70, flexShrink: 0 }}>Session vol</Typography>
                        <Slider size="small" min={0} max={1} step={0.05} value={playback?.volume ?? 1}
                            onChange={(_, v) => setGmVolume(v as number)} />
                    </Box>
                </>
            )}

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {masterVolume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <Slider size="small" min={0} max={1} step={0.05} value={masterVolume}
                    onChange={(_, v) => setMasterVolume(v as number)} />
            </Box>
        </Box>
    );
}
