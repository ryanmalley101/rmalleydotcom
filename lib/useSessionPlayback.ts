"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type SessionTrack = Schema["SessionTrack"]["type"];
type SessionPlayback = Schema["SessionPlayback"]["type"];

const DRIFT_CORRECTION_INTERVAL_MS = 25000;
const DRIFT_TOLERANCE_SECONDS = 2;

// Every client computes its own position from the shared timeline rather
// than reacting to a "play" command — see the design discussion this was
// built from. Resuming from a pause re-bases startedAtIso to now with
// offsetSeconds at wherever it was paused, so this formula covers both.
function computePosition(playback: SessionPlayback | null, track: SessionTrack | undefined): number {
    if (!playback || !playback.startedAtIso) return 0;
    const offset = playback.offsetSeconds ?? 0;
    if (playback.paused) return offset;
    const elapsed = (Date.now() - new Date(playback.startedAtIso).getTime()) / 1000;
    let position = offset + elapsed;
    if (playback.loop && track?.durationSeconds) position %= track.durationSeconds;
    return Math.max(0, position);
}

export function useSessionPlayback(campaignId: string, displayName: string) {
    const [tracks, setTracks] = useState<SessionTrack[]>([]);
    const [playback, setPlayback] = useState<SessionPlayback | null>(null);
    const [audioUrl, setAudioUrl] = useState("");
    const [masterVolume, setMasterVolumeState] = useState(1);
    const [prefId, setPrefId] = useState<string | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    const [uploading, setUploading] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastTrackIdRef = useRef<string | null | undefined>(undefined);
    const lastPausedRef = useRef<boolean | null | undefined>(undefined);

    // ── Personal master volume (UserPreference, lazily created — same
    // find-or-create pattern as useAutosaveDefault/useGmDashboardLayout) ─────
    useEffect(() => {
        client.models.UserPreference.list().then(({ data }) => {
            const existing = data?.[0];
            if (existing) {
                setPrefId(existing.id);
                if (existing.masterVolume != null) setMasterVolumeState(existing.masterVolume);
            }
        });
    }, []);

    const setMasterVolume = useCallback(async (v: number) => {
        setMasterVolumeState(v);
        if (prefId) {
            await client.models.UserPreference.update({ id: prefId, masterVolume: v });
        } else {
            const { data } = await client.models.UserPreference.create({ masterVolume: v });
            if (data) setPrefId(data.id);
        }
    }, [prefId]);

    // ── Tracks + playback, live (manual list + subscribe, not observeQuery) ──
    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.SessionTrack.list({ filter }).then(({ data }) => { if (!cancelled) setTracks(data ?? []); });
        client.models.SessionPlayback.list({ filter }).then(({ data }) => { if (!cancelled) setPlayback(data?.[0] ?? null); });

        const subs = [
            client.models.SessionTrack.onCreate().subscribe({
                next: item => { if (item && item.campaignId === campaignId) setTracks(prev => prev.some(t => t.id === item.id) ? prev : [...prev, item]); },
                error: err => console.error("[SessionPlayback] track onCreate error", err),
            }),
            client.models.SessionTrack.onDelete().subscribe({
                next: item => { if (item) setTracks(prev => prev.filter(t => t.id !== item.id)); },
                error: err => console.error("[SessionPlayback] track onDelete error", err),
            }),
            client.models.SessionPlayback.onCreate().subscribe({
                next: item => { if (item && item.campaignId === campaignId) setPlayback(item); },
                error: err => console.error("[SessionPlayback] playback onCreate error", err),
            }),
            client.models.SessionPlayback.onUpdate().subscribe({
                next: item => { if (item && item.campaignId === campaignId) setPlayback(item); },
                error: err => console.error("[SessionPlayback] playback onUpdate error", err),
            }),
        ];

        return () => { cancelled = true; subs.forEach(s => s.unsubscribe()); };
    }, [campaignId]);

    const activeTrack = tracks.find(t => t.id === playback?.trackId);

    // ── Resolve a fresh signed URL whenever the active track changes ─────────
    useEffect(() => {
        if (!activeTrack) { setAudioUrl(""); return; }
        let cancelled = false;
        getUrl({ path: activeTrack.storageKey, options: { expiresIn: 3600 } })
            .then(({ url }) => { if (!cancelled) setAudioUrl(url.toString()); })
            .catch(err => console.error("[SessionPlayback] failed to resolve track URL", err));
        return () => { cancelled = true; };
    }, [activeTrack?.storageKey]);

    // ── Autoplay-gesture priming: any real click/keypress anywhere on the
    // page unlocks this element for subsequent programmatic play() calls.
    // The play() call itself must stay synchronous inside the event handler
    // (not deferred to a later effect) — some mobile browsers only honor the
    // gesture exemption within the same call stack as the user interaction. ──
    useEffect(() => {
        if (unlocked) return;
        function unlock() {
            audioRef.current?.play().then(() => audioRef.current?.pause()).catch(() => {});
            setUnlocked(true);
        }
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, [unlocked]);

    // ── Seek/play/pause on track change or pause toggle ───────────────────────
    useEffect(() => {
        const el = audioRef.current;
        if (!el || !audioUrl) return;
        const trackChanged = lastTrackIdRef.current !== playback?.trackId;
        const pausedChanged = lastPausedRef.current !== playback?.paused;
        lastTrackIdRef.current = playback?.trackId ?? null;
        lastPausedRef.current = playback?.paused ?? null;

        if (trackChanged || pausedChanged) {
            const target = computePosition(playback, activeTrack);
            if (trackChanged || Math.abs(el.currentTime - target) > 0.5) el.currentTime = target;
            if (playback?.paused) el.pause();
            else if (unlocked) el.play().catch(() => {});
        }
    }, [playback, activeTrack, audioUrl, unlocked]);

    // A client that unlocks audio *after* playback already started (the
    // common case — page loads, then the user's first click unlocks it)
    // needs this separately: the effect above already ran with unlocked
    // false and skipped play().
    useEffect(() => {
        if (!unlocked || !audioUrl || !playback || playback.paused) return;
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = computePosition(playback, activeTrack);
        el.play().catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unlocked]);

    // ── Periodic drift correction — not continuous reseeking, which would
    // cause an audible stutter on every tick. ─────────────────────────────────
    useEffect(() => {
        if (!unlocked) return;
        const id = setInterval(() => {
            const el = audioRef.current;
            if (!el || !playback || playback.paused) return;
            const target = computePosition(playback, activeTrack);
            if (Math.abs(el.currentTime - target) > DRIFT_TOLERANCE_SECONDS) el.currentTime = target;
        }, DRIFT_CORRECTION_INTERVAL_MS);
        return () => clearInterval(id);
    }, [playback, activeTrack, unlocked]);

    // ── Effective volume = GM broadcast x personal ceiling ────────────────────
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        el.volume = Math.max(0, Math.min(1, (playback?.volume ?? 1) * masterVolume));
    }, [playback?.volume, masterVolume]);

    // ── GM actions ────────────────────────────────────────────────────────────
    async function ensurePlaybackRow(): Promise<SessionPlayback> {
        if (playback) return playback;
        const { data } = await client.models.SessionPlayback.create({ campaignId, paused: true, loop: true, volume: 1 });
        if (data) setPlayback(data);
        return data as SessionPlayback;
    }

    async function playTrack(trackId: string) {
        const row = await ensurePlaybackRow();
        const patch = { trackId, startedAtIso: new Date().toISOString(), offsetSeconds: 0, paused: false };
        setPlayback(prev => prev ? { ...prev, ...patch } : prev);
        await client.models.SessionPlayback.update({ id: row.id, ...patch });
    }

    async function togglePause() {
        if (!playback) return;
        const currentPosition = computePosition(playback, activeTrack);
        const patch = playback.paused
            ? { paused: false, offsetSeconds: currentPosition, startedAtIso: new Date().toISOString() }
            : { paused: true, offsetSeconds: currentPosition };
        setPlayback(prev => prev ? { ...prev, ...patch } : prev);
        await client.models.SessionPlayback.update({ id: playback.id, ...patch });
    }

    async function setLoop(loop: boolean) {
        const row = await ensurePlaybackRow();
        setPlayback(prev => prev ? { ...prev, loop } : prev);
        await client.models.SessionPlayback.update({ id: row.id, loop });
    }

    async function setGmVolume(volume: number) {
        const row = await ensurePlaybackRow();
        setPlayback(prev => prev ? { ...prev, volume } : prev);
        await client.models.SessionPlayback.update({ id: row.id, volume });
    }

    async function uploadTrack(file: File) {
        setUploading(true);
        try {
            const id = crypto.randomUUID();
            const ext = file.name.split(".").pop() ?? "mp3";
            const key = `session-music/${campaignId}/${id}.${ext}`;
            const durationSeconds = await new Promise<number>(resolve => {
                const probe = new window.Audio();
                probe.onloadedmetadata = () => resolve(probe.duration || 0);
                probe.onerror = () => resolve(0);
                probe.src = URL.createObjectURL(file);
            });
            await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
            const { data } = await client.models.SessionTrack.create({
                campaignId, name: file.name.replace(/\.[^.]+$/, ""), storageKey: key, durationSeconds, uploadedBy: displayName,
            });
            if (data) setTracks(prev => [...prev, data]);
        } catch (err) {
            console.error("[SessionPlayback] track upload failed", err);
        } finally {
            setUploading(false);
        }
    }

    async function deleteTrack(id: string) {
        setTracks(prev => prev.filter(t => t.id !== id));
        if (playback?.trackId === id) {
            await client.models.SessionPlayback.update({ id: playback.id, trackId: null, paused: true });
        }
        await client.models.SessionTrack.delete({ id });
    }

    return {
        audioRef, audioUrl, tracks, activeTrack, playback,
        unlocked, uploading, masterVolume, setMasterVolume,
        playTrack, togglePause, setLoop, setGmVolume, uploadTrack, deleteTrack,
    };
}
