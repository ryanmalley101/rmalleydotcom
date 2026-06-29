"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    Alert,
    Box,
    Button,
    Chip,
    Collapse,
    Container,
    Divider,
    LinearProgress,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { Activity, AlertTriangle, ArrowLeft, Check, ChevronDown, Clipboard, FileText, Printer, Upload, X } from "lucide-react";

import { loadCapture } from "./lib/parser";
import {
    analyze,
    DEFAULT_VERKADA_CLOUD_SUFFIXES,
    DEFAULT_VERKADA_OUIS,
    STAGE_LABEL,
    STAGE_ORDER,
    type AnalysisResult,
    type DeviceReport,
    type Diagnosis,
    type PacketRef,
    type ReportLine,
    type Severity,
} from "./lib/analyzer";
import { loadDeviceList, type DeviceListLoad } from "./lib/deviceList";

const SEVERITY_COLOR: Record<Severity, string> = {
    PASS: "#3fb950",
    INFO: "#58a6ff",
    WARNING: "#d29922",
    CRITICAL: "#f85149",
    NEUTRAL: "#8b949e",
};

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "INFO", "PASS", "NEUTRAL"];
const DEFAULT_VISIBLE: Severity[] = ["CRITICAL", "WARNING"];

export default function PcapAnalyzerPage() {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [filename, setFilename] = useState<string | null>(null);
    const [fileSize, setFileSize] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [macInput, setMacInput] = useState("");
    const [ouiInput, setOuiInput] = useState("");
    const [hostnameInput, setHostnameInput] = useState("");
    const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
    const [deviceList, setDeviceList] = useState<DeviceListLoad | null>(null);
    const [deviceListFilename, setDeviceListFilename] = useState<string | null>(null);
    const [deviceListError, setDeviceListError] = useState<string | null>(null);
    const csvRef = useRef<HTMLInputElement | null>(null);
    const [visibleSeverities, setVisibleSeverities] = useState<Set<Severity>>(
        () => new Set(DEFAULT_VISIBLE),
    );

    const severityCounts = useMemo(() => {
        const counts: Record<Severity, number> = {
            CRITICAL: 0, WARNING: 0, INFO: 0, PASS: 0, NEUTRAL: 0,
        };
        if (!result) return counts;
        for (const d of result.devices) for (const l of d.lines) counts[l.severity]++;
        return counts;
    }, [result]);

    const totalProblems = useMemo(() => {
        if (!result) return 0;
        return result.devices.reduce((n, d) => n + d.diagnoses.length, 0);
    }, [result]);

    function toggleSeverity(s: Severity) {
        setVisibleSeverities(prev => {
            const next = new Set(prev);
            if (next.has(s)) next.delete(s); else next.add(s);
            return next;
        });
    }

    async function handleFile(f: File) {
        setError(null);
        setResult(null);
        setLoading(true);
        setFilename(f.name);
        setFileSize(f.size);
        try {
            // Yield to the browser so the loading state paints before we
            // start the (potentially CPU-heavy) parse on the main thread.
            await new Promise(r => setTimeout(r, 0));
            const packets = await loadCapture(f);
            const extraMacs = macInput
                .split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const extraOuis = ouiInput
                .split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
            const extraSuffixes = hostnameInput
                .split(/[\s,]+/).map(s => s.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
            const r = analyze(packets, {
                targetMacs: extraMacs.length ? extraMacs : undefined,
                ouis: [...DEFAULT_VERKADA_OUIS, ...extraOuis],
                hostnameSuffixes: extraSuffixes.length
                    ? [...DEFAULT_VERKADA_CLOUD_SUFFIXES, ...extraSuffixes]
                    : undefined,
                deviceMacInfo: deviceList?.macIndex,
            });
            setResult(r);
        } catch (e) {
            setError((e as Error).message || "Failed to parse capture.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeviceListFile(f: File) {
        setDeviceListError(null);
        try {
            const text = await f.text();
            const load = loadDeviceList(text);
            if (load.macIndex.size === 0) {
                setDeviceListError("No MAC addresses found in this CSV. Expected a Verkada Command device-list export.");
                return;
            }
            setDeviceList(load);
            setDeviceListFilename(f.name);
        } catch (e) {
            setDeviceListError((e as Error).message || "Failed to read CSV file.");
        }
    }

    function clearDeviceList() {
        setDeviceList(null);
        setDeviceListFilename(null);
        setDeviceListError(null);
        if (csvRef.current) csvRef.current.value = "";
    }

    function printReport() {
        window.print();
    }

    async function copyMarkdown() {
        if (!result) return;
        const md = renderMarkdown(filename ?? "capture", result);
        try {
            await navigator.clipboard.writeText(md);
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        } catch {
            // Clipboard write can fail when not on https/localhost — fall back to a download.
            const blob = new Blob([md], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${(filename ?? "capture").replace(/\.[^.]+$/, "")}-audit.md`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function onPickClick() {
        fileRef.current?.click();
    }

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }} className="pcap-report-root">
            <style>{`
                @media print {
                    @page { size: letter; margin: 0.5in; }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .pcap-no-print { display: none !important; }
                    .pcap-report-root {
                        background: #ffffff !important;
                        padding: 0 !important;
                        min-height: 0 !important;
                    }
                    .pcap-report-root .MuiContainer-root { max-width: 100% !important; padding: 0 !important; }
                    .pcap-report-root .MuiPaper-root {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        border: 1px solid #cccccc !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .pcap-report-root .MuiTypography-root { color: #000000 !important; }
                    .pcap-report-root .MuiTypography-caption,
                    .pcap-report-root .MuiTypography-overline { color: #555555 !important; }
                    .pcap-report-root .MuiAlert-root {
                        background-color: #f5f5f5 !important;
                        color: #000000 !important;
                        border: 1px solid #cccccc !important;
                    }
                    .pcap-report-root .MuiChip-root {
                        background-color: #f0f0f0 !important;
                        color: #000000 !important;
                        border-color: #999999 !important;
                    }
                    .pcap-device-card {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        margin-bottom: 12pt !important;
                    }
                    .pcap-diagnosis { page-break-inside: avoid; break-inside: avoid; }
                    .pcap-print-only { display: block !important; }
                }
                .pcap-print-only { display: none; }
            `}</style>
            <Container maxWidth="md">
                <Button
                    component={Link}
                    href="/software"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                    className="pcap-no-print"
                >
                    Back
                </Button>

                <Box className="pcap-print-only" sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Verkada PCAP Audit
                    </Typography>
                    {filename && (
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {filename}
                            {result?.captureQuality.durationSec != null && ` · ${result.captureQuality.durationSec.toFixed(1)}s · ${result.packetCount.toLocaleString()} packets`}
                        </Typography>
                    )}
                    {deviceList && (
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            device list: {deviceListFilename} ({deviceList.deviceCount} devices)
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }} className="pcap-no-print">
                    <Activity size={32} color="#6366f1" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                        Verkada Packet Capture Analyzer
                    </Typography>
                </Box>

                <Typography variant="body1" className="pcap-no-print" sx={{ color: "text.secondary", mb: 4, maxWidth: 720 }}>
                    Audit per-device network health from a Verkada packet capture. Supports{" "}
                    <Box component="code" sx={{ fontFamily: "monospace", color: "primary.light" }}>
                        .pcap
                    </Box>
                    ,{" "}
                    <Box component="code" sx={{ fontFamily: "monospace", color: "primary.light" }}>
                        .pcapng
                    </Box>
                    , and{" "}
                    <Box component="code" sx={{ fontFamily: "monospace", color: "primary.light" }}>
                        .pcap.zst
                    </Box>
                    . Everything runs in your browser — the file never leaves your machine.
                </Typography>

                <Paper
                    variant="outlined"
                    onDrop={onDrop}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className="pcap-no-print"
                    sx={{
                        p: 4,
                        mb: 3,
                        textAlign: "center",
                        borderStyle: "dashed",
                        borderWidth: 2,
                        borderColor: dragOver ? "primary.main" : "divider",
                        backgroundColor: dragOver ? "rgba(99,102,241,0.06)" : "background.paper",
                        transition: "background-color 0.15s, border-color 0.15s",
                    }}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pcap,.pcapng,.cap,.zst"
                        style={{ display: "none" }}
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) void handleFile(f);
                            e.target.value = "";
                        }}
                    />
                    <Upload size={28} color="#6366f1" />
                    <Typography sx={{ mt: 1, mb: 2, color: "text.secondary" }}>
                        Drag a capture file here, or choose one to analyze.
                    </Typography>
                    <Button variant="contained" onClick={onPickClick} disabled={loading}>
                        Choose file
                    </Button>
                    {filename && (
                        <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.disabled", fontFamily: "monospace" }}>
                            {filename}
                            {fileSize != null && ` · ${formatBytes(fileSize)}`}
                        </Typography>
                    )}
                </Paper>

                <Paper variant="outlined" className="pcap-no-print" sx={{ p: 2.5, mb: 4, backgroundColor: "background.paper" }}>
                    <Typography variant="overline" sx={{ color: "text.disabled" }}>
                        Match settings (optional)
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Restrict to MACs"
                            placeholder="aa:bb:cc:dd:ee:ff, …"
                            value={macInput}
                            onChange={e => setMacInput(e.target.value)}
                            size="small"
                            fullWidth
                            helperText="Comma- or space-separated. Overrides OUI matching when set."
                        />
                        <TextField
                            label="Extra OUIs"
                            placeholder="e0:a7:00, …"
                            value={ouiInput}
                            onChange={e => setOuiInput(e.target.value)}
                            size="small"
                            fullWidth
                            helperText={`Adds to defaults: ${DEFAULT_VERKADA_OUIS.join(", ")}`}
                        />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
                        <TextField
                            label="Extra cloud hostname suffixes"
                            placeholder="acme-verkada.example, …"
                            value={hostnameInput}
                            onChange={e => setHostnameInput(e.target.value)}
                            size="small"
                            fullWidth
                            helperText={`Adds to defaults: ${DEFAULT_VERKADA_CLOUD_SUFFIXES.join(", ")}`}
                        />
                    </Stack>

                    <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                        <Typography variant="overline" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
                            Device list (optional)
                        </Typography>
                        <input
                            ref={csvRef}
                            type="file"
                            accept=".csv,text/csv"
                            style={{ display: "none" }}
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleDeviceListFile(f);
                                e.target.value = "";
                            }}
                        />
                        {deviceList ? (
                            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                <Chip
                                    icon={<FileText size={14} />}
                                    label={`${deviceListFilename} · ${deviceList.deviceCount} devices, ${deviceList.macCount} MACs`}
                                    onDelete={clearDeviceList}
                                    deleteIcon={<X size={14} />}
                                    sx={{ fontFamily: "monospace" }}
                                />
                                <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                    MAC → name mapping applied. CSV MACs are added to the match set.
                                </Typography>
                            </Stack>
                        ) : (
                            <Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FileText size={14} />}
                                    onClick={() => csvRef.current?.click()}
                                >
                                    Upload device list (.csv)
                                </Button>
                                <Typography variant="caption" sx={{ display: "block", color: "text.disabled", mt: 1 }}>
                                    Export from Verkada Command → Devices → Export. Used to label devices with their friendly names and to include MACs not covered by the default OUI list (e.g. third-party cameras, viewing stations).
                                </Typography>
                            </Box>
                        )}
                        {deviceListError && (
                            <Alert severity="error" sx={{ mt: 1 }}>{deviceListError}</Alert>
                        )}
                    </Box>
                </Paper>

                {loading && (
                    <Box sx={{ mb: 3 }}>
                        <LinearProgress />
                        <Typography variant="caption" sx={{ color: "text.disabled", mt: 1, display: "block" }}>
                            Parsing capture — large files may take a few seconds.
                        </Typography>
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {result && (
                    <>
                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
                            <Chip label={`${result.packetCount.toLocaleString()} packets`} size="small" />
                            <Chip label={`${result.devices.length} device${result.devices.length === 1 ? "" : "s"} matched`} size="small" />
                            {result.captureQuality.durationSec != null && (
                                <Chip label={`${result.captureQuality.durationSec.toFixed(1)}s capture`} size="small" />
                            )}
                            {totalProblems > 0 ? (
                                <Chip
                                    label={`${totalProblems} problem${totalProblems === 1 ? "" : "s"} detected`}
                                    size="small"
                                    sx={{ backgroundColor: "rgba(248,81,73,0.18)", color: "#f85149", fontWeight: 600 }}
                                />
                            ) : (
                                result.devices.length > 0 && (
                                    <Chip
                                        label="no problems detected"
                                        size="small"
                                        sx={{ backgroundColor: "rgba(63,185,80,0.18)", color: "#3fb950", fontWeight: 600 }}
                                    />
                                )
                            )}
                            <Chip label={result.targetMacs ? `MACs: ${result.targetMacs.length}` : `OUIs: ${result.ouisUsed.join(", ")}`} size="small" variant="outlined" />
                            <Box sx={{ flexGrow: 1 }} className="pcap-no-print" />
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={copyState === "copied" ? <Check size={14} /> : <Clipboard size={14} />}
                                onClick={copyMarkdown}
                                className="pcap-no-print"
                            >
                                {copyState === "copied" ? "Copied" : "Copy as markdown"}
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Printer size={14} />}
                                onClick={printReport}
                                className="pcap-no-print"
                            >
                                Save as PDF
                            </Button>
                        </Stack>

                        {result.captureQuality.notes.length > 0 && (
                            <Alert severity="warning" icon={<AlertTriangle size={16} />} sx={{ mb: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Capture quality</Typography>
                                {result.captureQuality.notes.map((n, i) => (
                                    <Typography key={i} variant="body2" sx={{ lineHeight: 1.55 }}>• {n}</Typography>
                                ))}
                            </Alert>
                        )}

                        {result.devices.length > 0 && (
                            <Paper variant="outlined" className="pcap-no-print" sx={{ p: 2, mb: 3, backgroundColor: "background.paper" }}>
                                <Typography variant="overline" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
                                    Show technical detail
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                                    {SEVERITY_ORDER.map(s => {
                                        const active = visibleSeverities.has(s);
                                        const color = SEVERITY_COLOR[s];
                                        return (
                                            <Chip
                                                key={s}
                                                label={`${s.toLowerCase()} · ${severityCounts[s]}`}
                                                size="small"
                                                onClick={() => toggleSeverity(s)}
                                                sx={{
                                                    cursor: "pointer",
                                                    fontFamily: "monospace",
                                                    fontWeight: 600,
                                                    borderColor: color,
                                                    color: active ? "#0d1117" : color,
                                                    backgroundColor: active ? color : "transparent",
                                                    border: `1px solid ${color}`,
                                                    "&:hover": {
                                                        backgroundColor: active ? color : `${color}22`,
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Stack>
                            </Paper>
                        )}
                    </>
                )}

                {result && result.devices.length === 0 && !loading && (
                    <Alert severity="warning">
                        No Verkada devices matched. Add specific MACs above, or extend the OUI list, then reload the file.
                    </Alert>
                )}

                {result?.devices.map(dev => {
                    const visibleLines = dev.lines.filter(l => visibleSeverities.has(l.severity));
                    return (
                        <Paper key={dev.mac} variant="outlined" className="pcap-device-card" sx={{ p: 3, mb: 3, backgroundColor: "background.paper" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 0.5 }}>
                                <Typography variant="overline" sx={{ color: "text.disabled" }}>
                                    Device audit
                                </Typography>
                                {dev.diagnoses.length > 0 && (
                                    <Chip
                                        size="small"
                                        icon={<AlertTriangle size={14} />}
                                        label={`${dev.diagnoses.length} problem${dev.diagnoses.length === 1 ? "" : "s"}`}
                                        sx={{
                                            backgroundColor: "rgba(248,81,73,0.15)",
                                            color: "#f85149",
                                            fontWeight: 600,
                                            "& .MuiChip-icon": { color: "#f85149" },
                                        }}
                                    />
                                )}
                            </Box>
                            {dev.csvInfo && (
                                <Box sx={{ mb: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                                        {dev.csvInfo.name || "(unnamed device)"}
                                    </Typography>
                                    {dev.csvInfo.model && (
                                        <Chip
                                            size="small"
                                            label={dev.csvInfo.model}
                                            sx={{ height: 20, fontSize: "0.7rem", fontFamily: "monospace" }}
                                        />
                                    )}
                                    {dev.csvInfo.thirdParty && (
                                        <Chip
                                            size="small"
                                            label="3rd-party"
                                            sx={{ height: 20, fontSize: "0.7rem", backgroundColor: "rgba(56,189,248,0.18)", color: "#38bdf8" }}
                                        />
                                    )}
                                </Box>
                            )}
                            <Typography variant={dev.csvInfo ? "body2" : "h6"} sx={{ fontFamily: "monospace", mb: dev.labels.length ? 0.5 : 2, color: "primary.light", letterSpacing: 0.5 }}>
                                {dev.mac.toUpperCase()}
                            </Typography>
                            {dev.labels.length > 0 && (
                                <Typography variant="caption" sx={{ display: "block", color: "text.disabled", mb: 0.5, fontFamily: "monospace" }}>
                                    {dev.labels.join(" · ")}
                                </Typography>
                            )}
                            {dev.lldpSysDesc && (
                                <Typography variant="caption" sx={{ display: "block", color: "text.disabled", mb: 2, fontFamily: "monospace", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    upstream switch · {dev.lldpSysDesc}
                                </Typography>
                            )}
                            <StageProgress stage={dev.stage} />
                            <Divider sx={{ mb: 2 }} />

                            {dev.diagnoses.length > 0 ? (
                                <Stack spacing={1.25} sx={{ mb: visibleLines.length || dev.tlsAlerts.length ? 2.5 : 0 }}>
                                    {dev.diagnoses.map((dx, i) => (
                                        <DiagnosisRow key={i} dx={dx} captureStart={result.captureQuality.firstTs ?? undefined} />
                                    ))}
                                </Stack>
                            ) : (
                                <Alert severity="success" icon={false} sx={{ mb: visibleLines.length || dev.tlsAlerts.length ? 2.5 : 0, backgroundColor: "rgba(63,185,80,0.08)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.25)" }}>
                                    No problems detected for this device.
                                </Alert>
                            )}

                            {visibleLines.length > 0 && (
                                <>
                                    <Typography variant="overline" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
                                        Technical detail
                                    </Typography>
                                    <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                                        {visibleLines.map((line, i) => (
                                            <ReportLineRow key={i} line={line} />
                                        ))}
                                    </Box>
                                </>
                            )}

                            {dev.tlsAlerts.length > 0 && (
                                <Box
                                    sx={{
                                        mt: 2,
                                        p: 1.5,
                                        borderRadius: 1,
                                        backgroundColor: "rgba(248,81,73,0.08)",
                                        border: "1px solid rgba(248,81,73,0.25)",
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", color: "#f85149" }}>
                                        [!] TLS Alerts seen: [{dev.tlsAlerts.join(", ")}]
                                    </Typography>
                                </Box>
                            )}
                        </Paper>
                    );
                })}
            </Container>
        </Box>
    );
}

function DiagnosisRow({ dx, captureStart }: { dx: Diagnosis; captureStart?: number }) {
    const [expanded, setExpanded] = useState(false);
    const color = SEVERITY_COLOR[dx.severity];
    const hasPackets = (dx.packetRefs?.length ?? 0) > 0;
    return (
        <Box sx={{ borderRadius: 1, backgroundColor: `${color}14`, borderLeft: `3px solid ${color}`, overflow: "hidden" }}>
            <Box
                sx={{
                    display: "flex", gap: 1.5, alignItems: "flex-start", p: 1.5,
                    cursor: hasPackets ? "pointer" : "default",
                    userSelect: "none",
                }}
                onClick={hasPackets ? () => setExpanded(e => !e) : undefined}
            >
                <Box sx={{ flexShrink: 0, color, mt: "2px" }}>
                    <AlertTriangle size={18} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{ color, fontFamily: "monospace", fontWeight: 700, letterSpacing: 0.5, display: "block", mb: 0.25 }}
                    >
                        {dx.severity}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.6 }}>
                        {dx.text}
                    </Typography>
                </Box>
                {hasPackets && (
                    <Box
                        sx={{
                            flexShrink: 0, color: "text.disabled", mt: "2px",
                            transition: "transform 0.15s",
                            transform: expanded ? "rotate(180deg)" : "none",
                        }}
                        title={expanded ? "Hide packet details" : `Show ${dx.packetRefs!.length} packet${dx.packetRefs!.length === 1 ? "" : "s"}`}
                    >
                        <ChevronDown size={16} />
                    </Box>
                )}
            </Box>
            {hasPackets && (
                <Collapse in={expanded}>
                    <Box sx={{ px: 1.5, pb: 1.5, borderTop: `1px solid ${color}30` }}>
                        {dx.packetRefs!.map((pkt, i) => (
                            <PacketDetail key={i} packet={pkt} captureStart={captureStart} first={i === 0} />
                        ))}
                    </Box>
                </Collapse>
            )}
        </Box>
    );
}

function PacketDetail({ packet, captureStart, first }: { packet: PacketRef; captureStart?: number; first: boolean }) {
    const tsOffset = captureStart !== undefined && packet.ts > 0
        ? `+${(packet.ts - captureStart).toFixed(3)}s`
        : packet.ts > 0 ? `ts=${packet.ts.toFixed(3)}` : "";

    const headerLines: string[] = [
        `Ethernet  ${packet.srcMac.toUpperCase()}  →  ${packet.dstMac.toUpperCase()}  [${packet.ethertypeName}]`,
    ];
    if (packet.srcIp || packet.dstIp) {
        const ttlStr = packet.ipTtl !== undefined ? `  TTL=${packet.ipTtl}` : "";
        headerLines.push(`${packet.ethertypeName === "IPv6" ? "IPv6    " : "IPv4    "}  ${packet.srcIp ?? "?"}  →  ${packet.dstIp ?? "?"}  (${packet.ipProtoName ?? "?"}${ttlStr})`);
    }
    if (packet.srcPort !== undefined || packet.dstPort !== undefined) {
        const flagStr = packet.tcpFlags ? `  [${packet.tcpFlags}]` : "";
        headerLines.push(`${(packet.ipProtoName ?? "L4").padEnd(8)}  ${packet.srcPort ?? "?"}  →  ${packet.dstPort ?? "?"}${flagStr}`);
    }

    const bytes = packet.rawBytes;
    const hexLines: string[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
        const chunk = bytes.slice(i, i + 16);
        const offset = i.toString(16).padStart(4, "0");
        const hexPart = chunk.map(b => b.toString(16).padStart(2, "0")).join(" ").padEnd(47);
        const asciiPart = chunk.map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".").join("");
        hexLines.push(`${offset}  ${hexPart}  ${asciiPart}`);
    }

    return (
        <Box sx={{ mt: first ? 1 : 1.5 }}>
            <Typography
                variant="caption"
                sx={{ fontFamily: "monospace", color: "text.disabled", display: "block", mb: 0.5 }}
            >
                Packet #{packet.index}{tsOffset ? `  ·  ${tsOffset}` : ""}  ·  {packet.summary}
            </Typography>
            {headerLines.map((l, i) => (
                <Typography
                    key={i}
                    variant="caption"
                    sx={{ display: "block", fontFamily: "monospace", color: "text.secondary", lineHeight: 1.7 }}
                >
                    {l}
                </Typography>
            ))}
            <Box
                sx={{
                    mt: 0.75,
                    p: 1,
                    backgroundColor: "rgba(0,0,0,0.25)",
                    borderRadius: 0.5,
                    overflowX: "auto",
                }}
            >
                {hexLines.map((l, i) => (
                    <Typography
                        key={i}
                        variant="caption"
                        sx={{ display: "block", fontFamily: "monospace", whiteSpace: "pre", color: "text.primary", lineHeight: 1.5, fontSize: "0.72rem" }}
                    >
                        {l}
                    </Typography>
                ))}
            </Box>
        </Box>
    );
}

function ReportLineRow({ line }: { line: ReportLine }) {
    const color = SEVERITY_COLOR[line.severity];
    return (
        <Box
            component="li"
            sx={{
                display: "flex",
                gap: 1.25,
                mb: 0.75,
                alignItems: "flex-start",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                lineHeight: 1.55,
            }}
        >
            <Box component="span" sx={{ color, flexShrink: 0 }} aria-hidden>●</Box>
            <Box component="span" sx={{ color: "text.disabled", flexShrink: 0 }}>
                [{line.category}]
            </Box>
            {line.severity !== "NEUTRAL" && (
                <Box component="span" sx={{ color, fontWeight: 700, flexShrink: 0 }}>
                    {line.severity}:
                </Box>
            )}
            <Box component="span" sx={{ color: "text.primary", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {line.text}
            </Box>
        </Box>
    );
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function StageProgress({ stage }: { stage: DeviceReport["stage"] }) {
    const reachedSet = new Set(stage.reached);
    return (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                <Typography variant="caption" sx={{ color: "text.disabled", mr: 1, fontFamily: "monospace" }}>
                    STAGE
                </Typography>
                {STAGE_ORDER.map((s, i) => {
                    const reached = reachedSet.has(s);
                    const isBlocker = stage.blockedAt === s;
                    const label = STAGE_LABEL[s];
                    const color = reached ? "#3fb950" : isBlocker ? "#f85149" : "rgba(255,255,255,0.15)";
                    const tMs = stage.timings[s];
                    return (
                        <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                                sx={{
                                    px: 1, py: 0.25,
                                    borderRadius: 0.5,
                                    fontSize: "0.7rem",
                                    fontFamily: "monospace",
                                    fontWeight: 600,
                                    color: reached ? "#3fb950" : isBlocker ? "#f85149" : "text.disabled",
                                    border: `1px solid ${color}`,
                                    backgroundColor: reached ? "rgba(63,185,80,0.10)" : isBlocker ? "rgba(248,81,73,0.10)" : "transparent",
                                }}
                                title={tMs !== undefined ? `Reached at +${tMs.toFixed(2)}s from this device's first packet` : undefined}
                            >
                                {label}
                                {reached && tMs !== undefined && tMs > 0 && (
                                    <Box component="span" sx={{ ml: 0.5, color: "text.disabled", fontWeight: 400 }}>
                                        +{tMs < 1 ? `${(tMs * 1000).toFixed(0)}ms` : `${tMs.toFixed(1)}s`}
                                    </Box>
                                )}
                            </Box>
                            {i < STAGE_ORDER.length - 1 && (
                                <Box sx={{ width: 8, height: 1, backgroundColor: reachedSet.has(STAGE_ORDER[i + 1]) ? "#3fb950" : "rgba(255,255,255,0.10)" }} />
                            )}
                        </Box>
                    );
                })}
                {stage.blockedAt && (
                    <Typography variant="caption" sx={{ ml: 1, color: "#f85149", fontFamily: "monospace" }}>
                        → stalled at {STAGE_LABEL[stage.blockedAt]}
                    </Typography>
                )}
                {stage.completed && (
                    <Typography variant="caption" sx={{ ml: 1, color: "#3fb950", fontFamily: "monospace" }}>
                        ✓ full happy-path observed
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

// ----------------------------------------------------------------------------
// Markdown export
// ----------------------------------------------------------------------------

function renderMarkdown(filename: string, result: AnalysisResult): string {
    const lines: string[] = [];
    lines.push(`# Verkada PCAP Audit — ${filename}\n`);
    const cq = result.captureQuality;
    lines.push(`**Packets:** ${result.packetCount.toLocaleString()}`);
    if (cq.durationSec != null) lines.push(`**Duration:** ${cq.durationSec.toFixed(2)} s`);
    if (cq.snaplen != null) lines.push(`**Snaplen (inferred):** ${cq.snaplen} B`);
    lines.push(`**Devices matched:** ${result.devices.length} · **OUIs:** ${result.ouisUsed.join(", ")}`);
    lines.push(`**Cloud suffixes:** ${result.cloudSuffixesUsed.join(", ")}\n`);

    if (cq.notes.length) {
        lines.push(`## Capture quality`);
        for (const n of cq.notes) lines.push(`- ${n}`);
        lines.push("");
    }

    const l2bits: string[] = [];
    if (cq.lldpPeers.length) l2bits.push(`- LLDP peers: ${cq.lldpPeers.join("; ")}`);
    if (cq.cdpPeers.length) l2bits.push(`- CDP peers: ${cq.cdpPeers.join("; ")}`);
    if (cq.lldpSysDescs.length) l2bits.push(`- Switch sys-desc: ${cq.lldpSysDescs.join(" | ")}`);
    if (cq.bpduRoots.length) l2bits.push(`- STP root bridge(s): ${cq.bpduRoots.join(", ")}`);
    if (cq.stpTopologyChanges > 0) l2bits.push(`- STP topology changes: ${cq.stpTopologyChanges}`);
    if (cq.broadcastMulticastPct > 0) l2bits.push(`- Broadcast/multicast: ${cq.broadcastMulticastPct.toFixed(1)}%`);
    if (l2bits.length) {
        lines.push(`## L2 / topology`);
        for (const b of l2bits) lines.push(b);
        lines.push("");
    }

    for (const dev of result.devices) {
        if (dev.csvInfo) {
            const tp = dev.csvInfo.thirdParty ? " (3rd-party)" : "";
            lines.push(`## ${dev.csvInfo.name || "(unnamed)"} — \`${dev.mac.toUpperCase()}\`${tp}`);
            if (dev.csvInfo.model) lines.push(`_${dev.csvInfo.model}_`);
        } else {
            lines.push(`## Device \`${dev.mac.toUpperCase()}\``);
        }
        if (dev.labels.length) lines.push(`_${dev.labels.join(" · ")}_`);
        if (dev.lldpSysDesc) lines.push(`_upstream switch · ${dev.lldpSysDesc}_`);
        lines.push("");
        const stageStr = dev.stage.reached
            .map(s => {
                const t = dev.stage.timings[s];
                return t !== undefined && t > 0
                    ? `${STAGE_LABEL[s]} (+${t < 1 ? `${(t * 1000).toFixed(0)}ms` : `${t.toFixed(1)}s`})`
                    : STAGE_LABEL[s];
            })
            .join(" → ") || "(none)";
        lines.push(`**Connection stage:** ${stageStr}` +
            (dev.stage.blockedAt ? ` — stalled at ${STAGE_LABEL[dev.stage.blockedAt]}` : " — happy path complete"));
        lines.push("");

        if (dev.diagnoses.length) {
            lines.push(`### Problems`);
            for (const dx of dev.diagnoses) lines.push(`- **${dx.severity}:** ${dx.text}`);
            lines.push("");
        } else {
            lines.push(`_No problems detected._\n`);
        }

        if (dev.lines.length) {
            lines.push(`### Technical detail`);
            for (const l of dev.lines) {
                const sev = l.severity === "NEUTRAL" ? "" : `${l.severity}: `;
                lines.push(`- [${l.category}] ${sev}${l.text}`);
            }
            lines.push("");
        }

        if (dev.tlsAlerts.length) {
            lines.push(`### TLS alerts seen`);
            lines.push(dev.tlsAlerts.map(a => `\`${a}\``).join(", "));
            lines.push("");
        }
    }
    return lines.join("\n");
}
