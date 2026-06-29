/**
 * Verkada per-device PCAP audit.
 *
 * Walks the parsed packet list, accumulates per-device state by matching on
 * OUI or explicit MAC, and emits:
 *   - Plain-English diagnoses for each problem condition
 *   - A structured technical report (severity-categorized lines)
 *   - A connection-stage progression (LINK → AUTH → IP → GW → DNS → TIME → CLOUD)
 *   - Capture-quality metadata (duration, truncation, directionality, snaplen)
 */

import type { CsvDeviceInfo } from "./deviceList";
import {
    RawPacket,
    parseEther,
    parseIpv4,
    parseIpv6,
    parseArp,
    parseIcmp,
    parseIcmpv6,
    parseTcp,
    parseUdp,
    parseDhcp,
    parseDns,
    parseLldp,
    parseCdp,
    parseEapol,
    parseIgmp,
    parseBpdu,
    parseTlsClientHello,
    isStunMessage,
    looksLikeHttpRequest,
    isTlsGreaseValue,
    tlsVersionName,
    TCP_SYN,
    TCP_ACK,
    TCP_RST,
    TCP_FIN,
    type LldpMedPoE,
    type LldpMedNetworkPolicy,
    type TcpHdr,
} from "./parser";

export const DEFAULT_VERKADA_OUIS = ["e0:a7:00"];

export const DEFAULT_VERKADA_CLOUD_SUFFIXES = [
    "command.verkada.com",
    "verkada.com",
    "vkd.io",
];

export const VERKADA_LOCAL_TCP_PORTS = new Set<number>([4100]);

// ----------------------------------------------------------------------------
// Per-FQDN criticality classification
// ----------------------------------------------------------------------------

type FqdnCriticality = "essential" | "operational" | "auxiliary";

interface FqdnRule {
    /** Test against the lowercased hostname (trailing-dot stripped). */
    match: (host: string) => boolean;
    function: string;
    criticality: FqdnCriticality;
    failureImpact: string;
}

const VERKADA_FQDN_RULES: FqdnRule[] = [
    {
        match: h => h.startsWith("time."),
        function: "NTP / time sync",
        criticality: "essential",
        failureImpact: "Without time sync the camera cannot validate TLS certificates — the entire cloud stack fails.",
    },
    {
        match: h => h.startsWith("api."),
        function: "REST control plane",
        criticality: "essential",
        failureImpact: "Camera cannot reach the Verkada control plane.",
    },
    {
        match: h => h === "command.verkada.com" || h.endsWith(".command.verkada.com"),
        function: "Streaming / event channel",
        criticality: "essential",
        failureImpact: "Camera cannot upload video or push events.",
    },
    {
        match: h => h.startsWith("access."),
        function: "Access Control cloud",
        criticality: "essential",
        failureImpact: "Access readers / door controllers cannot reach Verkada Access — doors fail open or closed depending on policy.",
    },
    {
        match: h => h.startsWith("relay."),
        function: "Peer relay coordination",
        criticality: "operational",
        failureImpact: "Direct local viewing falls back to cloud-relay; not a hard failure.",
    },
    {
        match: h => h.startsWith("firmware.") || h.startsWith("update."),
        function: "OTA firmware updates",
        criticality: "auxiliary",
        failureImpact: "Camera continues to work, but firmware won't update.",
    },
];

function classifyVerkadaFqdn(host: string): FqdnRule | null {
    const h = host.toLowerCase().replace(/\.$/, "");
    for (const r of VERKADA_FQDN_RULES) if (r.match(h)) return r;
    return null;
}

// Commonly-seen public DoH endpoints (Cloudflare, Google, Quad9, AdGuard).
const KNOWN_DOH_IPV4 = new Set<string>([
    "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9", "149.112.112.112",
    "94.140.14.14", "94.140.15.15", "208.67.222.222", "208.67.220.220",
]);

const TLS_ALERTS: Record<number, string> = {
    0: "close_notify", 10: "unexpected_message", 20: "bad_record_mac",
    21: "decryption_failed", 22: "record_overflow",
    40: "handshake_failure", 41: "no_certificate",
    42: "bad_certificate", 43: "unsupported_certificate",
    44: "certificate_revoked", 45: "certificate_expired",
    46: "certificate_unknown", 47: "illegal_parameter",
    48: "unknown_ca", 49: "access_denied", 50: "decode_error",
    51: "decrypt_error", 70: "protocol_version",
    71: "insufficient_security", 80: "internal_error",
    86: "inappropriate_fallback", 90: "user_canceled",
    100: "no_renegotiation", 112: "unrecognized_name",
    116: "certificate_required",
};

const STP_MCAST_PREFIX = "01:80:c2:00:00:0";
// VTP and DTP frames use specific multicast destinations (01:00:0C:CC:CC:CC for CDP/VTP/DTP, 01:00:0C:CD:CD:D0 for STP variants).
const CISCO_TRUNK_MCAST_PREFIXES = ["01:00:0c:cc:cc:cc", "01:00:0c:cc:cc:cd"];

export type Severity = "PASS" | "INFO" | "WARNING" | "CRITICAL" | "NEUTRAL";

export interface ReportLine {
    category: string;
    severity: Severity;
    text: string;
}

export interface PacketRef {
    index: number;
    ts: number;
    srcMac: string;
    dstMac: string;
    ethertypeName: string;
    srcIp?: string;
    dstIp?: string;
    ipProtoName?: string;
    ipTtl?: number;
    srcPort?: number;
    dstPort?: number;
    tcpFlags?: string;
    summary: string;
    rawBytes: number[];
}

export interface Diagnosis {
    severity: "WARNING" | "CRITICAL";
    text: string;
    packetRefs?: PacketRef[];
}

export const STAGE_ORDER = ["LINK", "AUTH", "IP", "GATEWAY", "DNS", "TIME", "CLOUD_TCP", "CLOUD_TLS", "ESTABLISHED"] as const;
export type Stage = typeof STAGE_ORDER[number];

export const STAGE_LABEL: Record<Stage, string> = {
    LINK: "Link",
    AUTH: "802.1X",
    IP: "IP",
    GATEWAY: "Gateway",
    DNS: "DNS",
    TIME: "Time sync",
    CLOUD_TCP: "Cloud TCP",
    CLOUD_TLS: "Cloud TLS",
    ESTABLISHED: "Established",
};

export interface StageProgress {
    reached: Stage[];
    blockedAt: Stage | null;
    completed: boolean;
    /** Time (seconds) each stage was first reached, relative to the device's firstTs. Missing stages = not reached. */
    timings: Partial<Record<Stage, number>>;
}

export interface DeviceReport {
    mac: string;
    matchKind: "src" | "dst-only";
    lines: ReportLine[];
    diagnoses: Diagnosis[];
    stage: StageProgress;
    tlsAlerts: string[];
    sniHostnames: string[];
    tlsVersions: string[];
    packetCount: number;
    labels: string[];
    /** Switch system-description string from LLDP, if observed and unambiguously attributable. */
    lldpSysDesc?: string;
    /** Metadata pulled from an uploaded Verkada Command device-list CSV, if one matched this MAC. */
    csvInfo?: CsvDeviceInfo;
}

export interface CaptureQuality {
    durationSec: number | null;
    firstTs: number | null;
    lastTs: number | null;
    totalPackets: number;
    capturedBytes: number;
    onWireBytes: number;
    truncatedFrames: number;
    /** Inferred snaplen (largest caplen observed). Null if not enough samples. */
    snaplen: number | null;
    dstOnlyDeviceCount: number;
    appearsOneDirectional: boolean;
    lldpPeers: string[];
    cdpPeers: string[];
    /** Switch system-description strings observed. */
    lldpSysDescs: string[];
    /** STP root bridge IDs seen in Config BPDUs. */
    bpduRoots: string[];
    stpTopologyChanges: number;
    /** Percentage of frames addressed to broadcast or multicast destination MACs. */
    broadcastMulticastPct: number;
    /** Cisco trunk-control PDUs (DTP/VTP) seen on a port that *should* be an access port. */
    cdpTrunkPdusSeen: boolean;
    /** ICMPv6 Router Advertisements observed (informational; presence on an unexpected segment is the actual signal). */
    ipv6RaCount: number;
    /** Frames with caplen+payload-prefix exactly duplicated within ~1 ms — SPAN-direction-duplication. */
    duplicatedFrameCount: number;
    /** Devices whose only TCP-handshake observation was inbound (e.g. SYN-ACK without SYN) → SPAN mirroring the wrong direction. */
    spanReversedDeviceCount: number;
    notes: string[];
}

export interface AnalysisResult {
    devices: DeviceReport[];
    captureQuality: CaptureQuality;
    packetCount: number;
    ouisUsed: string[];
    targetMacs: string[] | null;
    cloudSuffixesUsed: string[];
}

export interface AnalyzeOptions {
    targetMacs?: string[];
    ouis?: string[];
    hostnameSuffixes?: string[];
    /**
     * MAC → device metadata from a Verkada Command device-list CSV. When provided,
     * those MACs are added to the match set (so third-party cameras and viewing
     * stations on non-Verkada OUIs are still analyzed) and the device-card UI is
     * labeled with the human name/model from the CSV.
     */
    deviceMacInfo?: Map<string, CsvDeviceInfo>;
}

// ============================================================================
// Internal state
// ============================================================================

interface CloudFlowStats {
    devBytes: number;
    netBytes: number;
    firstTs: number;
    lastTs: number;
    closedTs: number | null;
    /** TLS application_data records seen, by direction. */
    appDataFromDev: number;
    appDataFromNet: number;
    /** Time of first ClientHello and first app_data, for handshake-duration measurement. */
    clientHelloTs: number | null;
    firstAppDataTs: number | null;
}

interface DevState {
    matchedAsSrc: boolean;
    matchedAsDst: boolean;
    packetCount: number;
    firstTs: number | null;
    lastTs: number | null;

    ipv4: string | null;
    ipv6Addrs: Set<string>;
    ipv6TrafficSeen: boolean;
    dhcpv6Seen: boolean;
    subnetMaskPrefix: number | null;

    dhcpAckSeen: boolean;
    dhcpDiscoverCount: number;
    dhcpRequestCount: number;
    dhcpNakSeen: boolean;
    dhcpDeclineSeen: boolean;
    dhcpServerIds: Set<string>;
    dhcpLeaseTime: number | null;
    dhcpVendorClass: string | null;
    dhcpHostName: string | null;
    dhcpGateway: string | null;
    dhcpDns: string[];
    dhcpRelayObserved: boolean;
    /** discoverTime by xid → ts of DISCOVER, used to derive OFFER latency. */
    dhcpDiscoverTs: Map<number, number>;
    dhcpRequestTs: Map<number, number>;
    dhcpOfferLatencyMs: number | null;
    dhcpAckLatencyMs: number | null;

    ipTrafficSeen: boolean;
    lastSrcIp: string | null;
    offSubnetDestSeen: boolean;
    ipv4FragmentCount: number;

    gwArpReq: boolean;
    gwArpRes: boolean;
    gratuitousArpSeen: boolean;
    ipClaims: Map<string, Set<string>>;

    dnsQueries: Set<string>;
    dnsUdp53QueriesCount: number;
    dnsVerkadaQueries: Set<string>;
    /** Verkada FQDNs the device queried that received NO valid IP answer in this capture. */
    dnsVerkadaUnresolved: Set<string>;
    /** Verkada FQDNs that resolved (got at least one A/AAAA). */
    dnsVerkadaResolved: Set<string>;
    verkadaCloudIps: Set<string>;
    dnsResolvedByHost: Map<string, Set<string>>;
    dnsSuccessCount: number;
    dnsHijackWarn: string;
    dnsServersObserved: Set<string>;
    mdnsQueryCount: number;
    /** DNS query xid → ts for response-latency measurement. */
    dnsQueryTs: Map<number, number>;
    dnsResponseLatencyMs: number[];
    dnsRcodeCounts: Map<number, number>;
    /** Per lower-cased qname, set of original-case spellings (for 0x20 detection). */
    dnsCaseVariants: Map<string, Set<string>>;
    /** True when a Verkada hostname response had TTL < 30s (suspicious). */
    verkadaShortTtlSeen: boolean;

    ntpSent: boolean;
    ntpRcvd: boolean;
    ntpServers: Set<string>;

    synTimes: Map<string, number>;
    rttSamplesMs: number[];
    cloudSynDests: Set<string>;
    cloudSynackDests: Set<string>;
    cloudSynCount: Map<string, number>;
    cloudFlows: Map<string, CloudFlowStats>;
    /** Flow key → set of seqs (for retransmit detection). */
    cloudFlowSeqs: Map<string, Set<number>>;
    /** Flow key → last ack seen + how many consecutive packets repeated it (for dup-ACK detection). */
    cloudFlowDupAcks: Map<string, { lastAck: number; repeats: number }>;
    cloudDupAckCount: number;

    tls443: boolean;
    local4100AsServer: boolean;
    local4100AsClient: boolean;
    tcpRstFromDev: boolean;
    tcpRstFromNet: boolean;
    tcpRetransToCloud: number;
    tlsAlerts: Set<string>;
    badCertDetected: boolean;
    sniHostnames: Set<string>;
    sniToDestIps: Map<string, Set<string>>;
    /** TLS versions actually offered (filtered: GREASE removed; preference for supported_versions). */
    tlsVersionsObserved: Set<number>;
    /** True when any ClientHello used supported_versions; downgrades the legacy_version-only signal. */
    tlsVersionsViaExtension: boolean;
    tlsAlpns: Set<string>;
    cloudTlsApplicationDataSeen: boolean;

    /** Minimum TCP MSS observed on cloud-bound SYN/SYN-ACKs (for clamping detection). */
    cloudMinMss: number | null;
    /** Window-scale advertised on SYN/SYN-ACK observed on cloud flows (-1 = not yet seen). */
    cloudMaxWscale: number;
    cloudWscaleObserved: boolean;
    cloudSackPermObserved: boolean;
    cloudTimestampsObserved: boolean;
    /** TCP/443 SYN-ACKs from cloud counted. Used to know if we have data to make TCP-option diagnoses at all. */
    cloudSynAckCount: number;
    /** SYN counts from device vs SYN-ACKs from network — for SPAN-reversed detection. */
    tcpSynFromDev: number;
    tcpSynAckFromNet: number;

    vlansSeen: Set<number>;
    mdnsSeen: boolean;
    igmpGroupsJoined: Set<string>;

    eapolSeen: boolean;
    eapSuccess: boolean;
    eapFailure: boolean;

    pseMedPoe: LldpMedPoE | null;
    pdMedPoe: LldpMedPoE | null;
    medPolicy: LldpMedNetworkPolicy | null;

    healthWarnings: Set<string>;

    /** Inbound source IP → set of TTL values seen, for routing-stability detection. */
    inboundTtls: Map<string, Set<number>>;

    /** App-layer detections. */
    rtspSeen: boolean;
    ssdpSeen: boolean;
    llmnrSeen: boolean;
    stunSeen: boolean;
    dotSeen: boolean;
    dohSeen: boolean;
    plaintextHttpInternetCount: number;
    /** Local TLS flows to RFC1918 destinations that aren't the gateway — likely Command Connector. */
    commandConnectorDests: Set<string>;

    eventPackets: Map<string, PacketRef[]>;
    /** Per-stage relative timing (from device firstTs). */
    stageTimings: Partial<Record<Stage, number>>;
}

interface SharedState {
    lldpPeers: Set<string>;
    cdpPeers: Set<string>;
    lldpSysDescs: Set<string>;
    /** Per-port LLDP system-name + sysdesc, so single-device captures can attribute. */
    lldpSysDescByLabel: Map<string, string>;
    stpTopologyChanges: number;
    bpduRoots: Set<string>;
    cdpTrunkPdusSeen: boolean;
    ipv6RaCount: number;
    broadcastMulticastFrames: number;
    totalFrames: number;
    maxCapLen: number;
    /** Recent (data.length, first 8 bytes int) within ~1ms window — for SPAN duplicate detection. */
    recentFrameFingerprints: Map<string, number>;
    duplicatedFrameCount: number;
}

function newDevice(): DevState {
    return {
        matchedAsSrc: false, matchedAsDst: false, packetCount: 0, firstTs: null, lastTs: null,
        ipv4: null, ipv6Addrs: new Set(), ipv6TrafficSeen: false, dhcpv6Seen: false,
        subnetMaskPrefix: null,
        dhcpAckSeen: false, dhcpDiscoverCount: 0, dhcpRequestCount: 0,
        dhcpNakSeen: false, dhcpDeclineSeen: false,
        dhcpServerIds: new Set(), dhcpLeaseTime: null, dhcpVendorClass: null, dhcpHostName: null,
        dhcpGateway: null, dhcpDns: [], dhcpRelayObserved: false,
        dhcpDiscoverTs: new Map(), dhcpRequestTs: new Map(),
        dhcpOfferLatencyMs: null, dhcpAckLatencyMs: null,
        ipTrafficSeen: false, lastSrcIp: null, offSubnetDestSeen: false, ipv4FragmentCount: 0,
        gwArpReq: false, gwArpRes: false, gratuitousArpSeen: false, ipClaims: new Map(),
        dnsQueries: new Set(), dnsUdp53QueriesCount: 0,
        dnsVerkadaQueries: new Set(), dnsVerkadaUnresolved: new Set(), dnsVerkadaResolved: new Set(),
        verkadaCloudIps: new Set(), dnsResolvedByHost: new Map(),
        dnsSuccessCount: 0, dnsHijackWarn: "", dnsServersObserved: new Set(),
        mdnsQueryCount: 0,
        dnsQueryTs: new Map(), dnsResponseLatencyMs: [], dnsRcodeCounts: new Map(),
        dnsCaseVariants: new Map(), verkadaShortTtlSeen: false,
        ntpSent: false, ntpRcvd: false, ntpServers: new Set(),
        synTimes: new Map(), rttSamplesMs: [], cloudSynDests: new Set(), cloudSynackDests: new Set(),
        cloudSynCount: new Map(), cloudFlows: new Map(),
        cloudFlowSeqs: new Map(), cloudFlowDupAcks: new Map(), cloudDupAckCount: 0,
        tls443: false, local4100AsServer: false, local4100AsClient: false,
        tcpRstFromDev: false, tcpRstFromNet: false, tcpRetransToCloud: 0,
        tlsAlerts: new Set(), badCertDetected: false,
        sniHostnames: new Set(), sniToDestIps: new Map(),
        tlsVersionsObserved: new Set(), tlsVersionsViaExtension: false, tlsAlpns: new Set(),
        cloudTlsApplicationDataSeen: false,
        cloudMinMss: null, cloudMaxWscale: -1,
        cloudWscaleObserved: false, cloudSackPermObserved: false, cloudTimestampsObserved: false,
        cloudSynAckCount: 0, tcpSynFromDev: 0, tcpSynAckFromNet: 0,
        vlansSeen: new Set(), mdnsSeen: false, igmpGroupsJoined: new Set(),
        eapolSeen: false, eapSuccess: false, eapFailure: false,
        pseMedPoe: null, pdMedPoe: null, medPolicy: null,
        healthWarnings: new Set(),
        inboundTtls: new Map(),
        rtspSeen: false, ssdpSeen: false, llmnrSeen: false, stunSeen: false,
        dotSeen: false, dohSeen: false, plaintextHttpInternetCount: 0,
        commandConnectorDests: new Set(),
        eventPackets: new Map(),
        stageTimings: {},
    };
}

// ============================================================================
// Address helpers
// ============================================================================

function setToArray<T>(s: Set<T>): T[] { const a: T[] = []; s.forEach(v => a.push(v)); return a; }

function isMulticastMac(mac: string): boolean {
    const f = parseInt(mac.split(":")[0], 16);
    return !isNaN(f) && (f & 0x01) !== 0;
}
function isBroadcastMac(mac: string): boolean { return mac === "ff:ff:ff:ff:ff:ff"; }

function ipv4Parts(ip: string): number[] | null {
    const p = ip.split(".");
    if (p.length !== 4) return null;
    const n = p.map(s => parseInt(s, 10));
    if (n.some(x => isNaN(x) || x < 0 || x > 255)) return null;
    return n;
}
function isRfc1918(ip: string): boolean {
    const n = ipv4Parts(ip); if (!n) return false;
    if (n[0] === 10) return true;
    if (n[0] === 192 && n[1] === 168) return true;
    if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;
    return false;
}
function isCgnat(ip: string): boolean {
    const n = ipv4Parts(ip); if (!n) return false;
    return n[0] === 100 && n[1] >= 64 && n[1] <= 127;
}
function isLinkLocal(ip: string): boolean {
    const n = ipv4Parts(ip); if (!n) return false;
    return n[0] === 169 && n[1] === 254;
}
function isLoopbackOrZero(ip: string): boolean {
    const n = ipv4Parts(ip); if (!n) return false;
    return n[0] === 0 || n[0] === 127;
}
function isMulticastIp(ip: string): boolean {
    const n = ipv4Parts(ip); if (!n) return false;
    return n[0] >= 224 && n[0] <= 239;
}
function classifySuspiciousAnswer(ip: string): string | null {
    if (isRfc1918(ip)) return "RFC1918 private";
    if (isCgnat(ip)) return "CGNAT (100.64/10)";
    if (isLinkLocal(ip)) return "link-local";
    if (isLoopbackOrZero(ip)) return "loopback/0.0.0.0";
    return null;
}

function ipv4InSubnet(addr: string, base: string, prefix: number): boolean {
    const a = ipv4Parts(addr); const b = ipv4Parts(base);
    if (!a || !b) return false;
    const aN = ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
    const bN = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return ((aN ^ bN) & mask) === 0;
}

function isVerkadaHostname(name: string, suffixes: string[]): boolean {
    if (!name) return false;
    const n = name.toLowerCase().replace(/\.$/, "");
    return suffixes.some(s => n === s || n.endsWith("." + s));
}

function devicesFor(
    src: string, dst: string,
    targetMacs: Set<string> | null,
    ouis: string[],
    csvMacs: Set<string> | null,
): string[] {
    const result: string[] = [];
    // Explicit MAC restriction takes precedence over OUI/CSV matching.
    if (targetMacs) {
        if (targetMacs.has(src)) result.push(src);
        if (targetMacs.has(dst) && dst !== src) result.push(dst);
        return result;
    }
    const matches = (mac: string) => {
        if (csvMacs && csvMacs.has(mac)) return true;
        for (const oui of ouis) if (mac.startsWith(oui)) return true;
        return false;
    };
    if (matches(src)) result.push(src);
    if (!isBroadcastMac(dst) && !isMulticastMac(dst) && dst !== src && matches(dst)) {
        result.push(dst);
    }
    return result;
}

function parseTlsAlertsAndRecords(payload: Uint8Array): { alerts: number[]; appDataCount: number } {
    const alerts: number[] = [];
    let appDataCount = 0;
    let i = 0;
    const n = payload.length;
    while (i + 5 <= n) {
        const ctype = payload[i];
        const length = (payload[i + 3] << 8) | payload[i + 4];
        if (length === 0 || i + 5 + length > n) break;
        if (ctype === 0x15 && length >= 2) alerts.push(payload[i + 5 + 1]);
        if (ctype === 0x17) appDataCount++;
        i += 5 + length;
    }
    return { alerts, appDataCount };
}

function median(arr: number[]): number {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function stdev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
    return Math.sqrt(v);
}

function markStage(d: DevState, stage: Stage, ts: number) {
    if (d.stageTimings[stage] !== undefined) return;
    if (d.firstTs === null) return;
    d.stageTimings[stage] = Math.max(0, ts - d.firstTs);
}

function tcpFlagsStr(flags: number): string {
    const parts: string[] = [];
    if (flags & TCP_SYN) parts.push("SYN");
    if (flags & TCP_ACK) parts.push("ACK");
    if (flags & TCP_RST) parts.push("RST");
    if (flags & TCP_FIN) parts.push("FIN");
    if (flags & 0x08) parts.push("PSH");
    return parts.join("|") || `0x${flags.toString(16)}`;
}

function makePktRef(
    index: number,
    pkt: RawPacket,
    ether: NonNullable<ReturnType<typeof parseEther>>,
    summary: string,
    ipInfo?: { src: string; dst: string; proto: number; ttl?: number },
    transport?: { srcPort: number; dstPort: number; flags?: string },
): PacketRef {
    const ethertypeName =
        ether.type === 0x0800 ? "IPv4" :
        ether.type === 0x86dd ? "IPv6" :
        ether.type === 0x0806 ? "ARP" :
        ether.type === 0x888e ? "EAPOL" :
        ether.type === 0x8100 ? "802.1Q" :
        `0x${ether.type.toString(16).padStart(4, "0")}`;
    const ipProtoName = ipInfo
        ? ipInfo.proto === 6 ? "TCP" : ipInfo.proto === 17 ? "UDP" : ipInfo.proto === 1 ? "ICMP" : ipInfo.proto === 58 ? "ICMPv6" : `proto ${ipInfo.proto}`
        : undefined;
    return {
        index, ts: pkt.ts,
        srcMac: ether.src, dstMac: ether.dst,
        ethertypeName,
        srcIp: ipInfo?.src, dstIp: ipInfo?.dst,
        ipProtoName, ipTtl: ipInfo?.ttl,
        srcPort: transport?.srcPort, dstPort: transport?.dstPort,
        tcpFlags: transport?.flags,
        summary,
        rawBytes: Array.from(pkt.data.subarray(0, Math.min(128, pkt.data.length))),
    };
}

function addEventPkt(dev: DevState, tag: string, ref: PacketRef) {
    const arr = dev.eventPackets.get(tag) ?? [];
    if (arr.length < 3) { arr.push(ref); dev.eventPackets.set(tag, arr); }
}

// ============================================================================
// Main analyzer
// ============================================================================

export function analyze(packets: RawPacket[], opts: AnalyzeOptions = {}): AnalysisResult {
    const ouis = (opts.ouis ?? DEFAULT_VERKADA_OUIS).map(o => o.toLowerCase());
    const cloudSuffixes = (opts.hostnameSuffixes ?? DEFAULT_VERKADA_CLOUD_SUFFIXES).map(s => s.toLowerCase().replace(/^\./, ""));
    const targetMacs = opts.targetMacs && opts.targetMacs.length > 0
        ? new Set(opts.targetMacs.map(m => m.toLowerCase())) : null;
    const csvMacs: Set<string> | null = opts.deviceMacInfo && opts.deviceMacInfo.size > 0
        ? new Set(opts.deviceMacInfo.keys()) : null;

    const devices = new Map<string, DevState>();
    const shared: SharedState = {
        lldpPeers: new Set(), cdpPeers: new Set(),
        lldpSysDescs: new Set(), lldpSysDescByLabel: new Map(),
        stpTopologyChanges: 0, bpduRoots: new Set(),
        cdpTrunkPdusSeen: false, ipv6RaCount: 0,
        broadcastMulticastFrames: 0, totalFrames: 0, maxCapLen: 0,
        recentFrameFingerprints: new Map(), duplicatedFrameCount: 0,
    };

    let firstTs: number | null = null;
    let lastTs: number | null = null;
    let totalCapBytes = 0;
    let totalWireBytes = 0;
    let truncatedFrames = 0;

    let packetIndex = 0;
    for (const pkt of packets) {
        packetIndex++;
        if (pkt.ts > 0) {
            if (firstTs === null || pkt.ts < firstTs) firstTs = pkt.ts;
            if (lastTs === null || pkt.ts > lastTs) lastTs = pkt.ts;
        }
        totalCapBytes += pkt.data.length;
        totalWireBytes += pkt.origLen || pkt.data.length;
        if (pkt.origLen && pkt.origLen > pkt.data.length) truncatedFrames++;

        shared.totalFrames++;
        if (pkt.data.length > shared.maxCapLen) shared.maxCapLen = pkt.data.length;

        const ether = parseEther(pkt.data);
        if (!ether) continue;

        if (isBroadcastMac(ether.dst) || isMulticastMac(ether.dst)) {
            shared.broadcastMulticastFrames++;
        }

        // SPAN-duplicate detection: same length + first 16 payload bytes within 1ms.
        if (pkt.data.length >= 18 && pkt.ts > 0) {
            const fp = `${pkt.data.length}:` +
                Array.from(pkt.data.subarray(0, 16), b => b.toString(16).padStart(2, "0")).join("");
            const prevTs = shared.recentFrameFingerprints.get(fp);
            if (prevTs !== undefined && pkt.ts - prevTs <= 0.001) {
                shared.duplicatedFrameCount++;
            }
            shared.recentFrameFingerprints.set(fp, pkt.ts);
            if (shared.recentFrameFingerprints.size > 4096) {
                // prune oldest-by-iteration
                const it = shared.recentFrameFingerprints.keys();
                for (let n = 0; n < 1024; n++) {
                    const r = it.next();
                    if (r.done) break;
                    shared.recentFrameFingerprints.delete(r.value);
                }
            }
        }

        // STP / BPDU
        if (ether.dst.startsWith(STP_MCAST_PREFIX) && ether.type <= 0x05dc) {
            const bp = parseBpdu(pkt.data, ether.payloadOff);
            if (bp) {
                if (bp.topologyChange) shared.stpTopologyChanges++;
                if (bp.rootBridge) shared.bpduRoots.add(bp.rootBridge);
            }
        }

        // DTP/VTP — Cisco-trunk PDUs sent to specific multicast MACs.
        if (CISCO_TRUNK_MCAST_PREFIXES.includes(ether.dst) && ether.type <= 0x05dc) {
            // CDP itself is already captured; treat as trunk-PDU presence only when SNAP protocol != CDP (0x2000).
            const snapOff = ether.payloadOff + 8;
            if (snapOff <= pkt.data.length) {
                const snapProto = (pkt.data[ether.payloadOff + 6] << 8) | pkt.data[ether.payloadOff + 7];
                // 0x2000 CDP, 0x2003 VTP, 0x2004 DTP, 0x010b PVSTP+
                if (snapProto === 0x2003 || snapProto === 0x2004 || snapProto === 0x010b) {
                    shared.cdpTrunkPdusSeen = true;
                }
            }
        }

        // L2 link-local — LLDP / CDP / EAPOL
        if (ether.type === 0x88cc) {
            const r = parseLldp(pkt.data, ether.payloadOff);
            if (r) {
                const label = `${r.sysName ?? ""} / ${r.portId ?? ""}`.replace(/^\s*\/\s*|\s*\/\s*$/g, "").trim();
                if (label) shared.lldpPeers.add(label);
                if (r.sysDesc) {
                    shared.lldpSysDescs.add(r.sysDesc.trim());
                    if (label) shared.lldpSysDescByLabel.set(label, r.sysDesc.trim());
                }
                // LLDP-MED applies to whichever device(s) live on this segment.
                if (r.medPoE?.length || r.medPolicy?.length) {
                    devices.forEach(dev => {
                        if (r.medPoE) for (const poe of r.medPoE) {
                            if (poe.powerType === "PSE") dev.pseMedPoe = poe;
                            else if (poe.powerType === "PD") dev.pdMedPoe = poe;
                        }
                        if (r.medPolicy && r.medPolicy.length) dev.medPolicy = r.medPolicy[0];
                    });
                }
            }
        }
        if (ether.type <= 0x05dc) {
            const r = parseCdp(pkt.data, ether.payloadOff);
            if (r) {
                const label = `${r.devId ?? ""} / ${r.portId ?? ""}`.replace(/^\s*\/\s*|\s*\/\s*$/g, "").trim();
                if (label) shared.cdpPeers.add(label);
            }
        }

        const matched = devicesFor(ether.src, ether.dst, targetMacs, ouis, csvMacs);

        if (ether.type === 0x888e) {
            const r = parseEapol(pkt.data, ether.payloadOff);
            for (const vMac of matched) {
                const dev = devices.get(vMac) ?? newDevice();
                dev.eapolSeen = true;
                if (r?.eapCode === 3) { dev.eapSuccess = true; markStage(dev, "AUTH", pkt.ts); }
                else if (r?.eapCode === 4) {
                    dev.eapFailure = true;
                    addEventPkt(dev, "eap_failure", makePktRef(packetIndex, pkt, ether, "EAP Failure"));
                }
                devices.set(vMac, dev);
            }
        }

        if (matched.length === 0) continue;

        for (const vMac of matched) {
            const dev = devices.get(vMac) ?? newDevice();
            devices.set(vMac, dev);
            const fromDev = (ether.src === vMac);
            if (fromDev) {
                dev.matchedAsSrc = true;
                if (dev.stageTimings.LINK === undefined && dev.firstTs === null) {
                    // First src packet → stage timing baseline is set by firstTs assignment below
                }
            } else dev.matchedAsDst = true;
            dev.packetCount++;
            if (pkt.ts > 0) {
                if (dev.firstTs === null || pkt.ts < dev.firstTs) dev.firstTs = pkt.ts;
                if (dev.lastTs === null || pkt.ts > dev.lastTs) dev.lastTs = pkt.ts;
            }
            // Mark LINK now that firstTs is set.
            if (fromDev) markStage(dev, "LINK", pkt.ts);

            if (ether.vlan !== undefined) dev.vlansSeen.add(ether.vlan);

            processPacket(pkt, ether, dev, fromDev, vMac, ether.dst, cloudSuffixes, shared, packetIndex);
        }
    }

    // Derive unresolved-Verkada-FQDNs per device.
    devices.forEach(d => {
        d.dnsVerkadaQueries.forEach(q => {
            const resolved = d.dnsResolvedByHost.get(q);
            if (resolved && resolved.size > 0) d.dnsVerkadaResolved.add(q);
            else d.dnsVerkadaUnresolved.add(q);
        });
    });

    const deviceReports: DeviceReport[] = [];
    devices.forEach((d, mac) => {
        const matchKind: "src" | "dst-only" = d.matchedAsSrc ? "src" : "dst-only";
        const csvInfo = opts.deviceMacInfo?.get(mac);
        const labels: string[] = [];
        if (csvInfo?.serial) labels.push(`serial: ${csvInfo.serial}`);
        if (csvInfo?.site) labels.push(`site: ${csvInfo.site}`);
        if (d.dhcpHostName) labels.push(`hostname: ${d.dhcpHostName}`);
        if (d.dhcpVendorClass) labels.push(`vendor-class: ${d.dhcpVendorClass}`);

        // TLS version display: prefer supported_versions; filter GREASE; suppress legacy_version=0x0303 if extension was used.
        const usable: number[] = [];
        d.tlsVersionsObserved.forEach(v => {
            if (isTlsGreaseValue(v)) return;
            if (d.tlsVersionsViaExtension && v === 0x0303) return;
            usable.push(v);
        });
        usable.sort((a, b) => a - b);

        let lldpSysDesc: string | undefined;
        if (devices.size === 1 && shared.lldpSysDescs.size === 1) {
            shared.lldpSysDescs.forEach(s => { lldpSysDesc = s; });
        }

        deviceReports.push({
            mac, matchKind,
            lines: buildReport(d, shared, cloudSuffixes),
            diagnoses: buildDiagnoses(d, cloudSuffixes),
            stage: computeStage(d),
            tlsAlerts: setToArray(d.tlsAlerts).sort(),
            sniHostnames: setToArray(d.sniHostnames).sort(),
            tlsVersions: usable.map(tlsVersionName),
            packetCount: d.packetCount,
            labels,
            lldpSysDesc,
            csvInfo,
        });
    });
    deviceReports.sort((a, b) => a.mac.localeCompare(b.mac));

    let dstOnlyDeviceCount = 0;
    let anyBidirectional = false;
    let spanReversedDeviceCount = 0;
    deviceReports.forEach(d => {
        if (d.matchKind === "dst-only") dstOnlyDeviceCount++;
        if (d.matchKind === "src") anyBidirectional = true;
    });
    devices.forEach(d => {
        if (d.tcpSynAckFromNet >= 2 && d.tcpSynFromDev === 0) spanReversedDeviceCount++;
    });

    const broadcastPct = shared.totalFrames > 0
        ? (shared.broadcastMulticastFrames / shared.totalFrames) * 100
        : 0;

    const snaplen = shared.maxCapLen > 0 ? shared.maxCapLen : null;

    const captureQuality: CaptureQuality = {
        durationSec: firstTs !== null && lastTs !== null ? lastTs - firstTs : null,
        firstTs, lastTs,
        totalPackets: packets.length,
        capturedBytes: totalCapBytes,
        onWireBytes: totalWireBytes,
        truncatedFrames,
        snaplen,
        dstOnlyDeviceCount,
        appearsOneDirectional: deviceReports.length > 0 && !anyBidirectional,
        lldpPeers: setToArray(shared.lldpPeers).sort(),
        cdpPeers: setToArray(shared.cdpPeers).sort(),
        lldpSysDescs: setToArray(shared.lldpSysDescs).sort(),
        bpduRoots: setToArray(shared.bpduRoots).sort(),
        stpTopologyChanges: shared.stpTopologyChanges,
        broadcastMulticastPct: broadcastPct,
        cdpTrunkPdusSeen: shared.cdpTrunkPdusSeen,
        ipv6RaCount: shared.ipv6RaCount,
        duplicatedFrameCount: shared.duplicatedFrameCount,
        spanReversedDeviceCount,
        notes: buildCaptureNotes({
            firstTs, lastTs, truncated: truncatedFrames, totalPkts: packets.length,
            devices: deviceReports, anyBidirectional,
            broadcastPct, snaplen, duplicatedFrameCount: shared.duplicatedFrameCount,
            spanReversedDeviceCount, cdpTrunkPdusSeen: shared.cdpTrunkPdusSeen,
        }),
    };

    return {
        devices: deviceReports, captureQuality,
        packetCount: packets.length, ouisUsed: ouis,
        targetMacs: targetMacs ? setToArray(targetMacs) : null,
        cloudSuffixesUsed: cloudSuffixes,
    };
}

// ============================================================================
// Per-packet processing
// ============================================================================

function processPacket(
    pkt: RawPacket,
    ether: NonNullable<ReturnType<typeof parseEther>>,
    dev: DevState,
    fromDev: boolean,
    vMac: string,
    dstMac: string,
    cloudSuffixes: string[],
    shared: SharedState,
    packetIndex: number,
): void {
    if (ether.type === 0x86dd) {
        processIpv6(pkt, ether, dev, fromDev, vMac, dstMac, cloudSuffixes, shared, packetIndex);
        return;
    }

    if (ether.type === 0x0806) {
        const arp = parseArp(pkt.data, ether.payloadOff);
        if (arp) {
            if (arp.op === 2 || (arp.op === 1 && arp.spa === arp.tpa)) {
                if (arp.spa !== "0.0.0.0" && !arp.spa.endsWith(".255")) {
                    let set = dev.ipClaims.get(arp.spa);
                    if (!set) { set = new Set(); dev.ipClaims.set(arp.spa, set); }
                    set.add(arp.sha);
                }
            }
            if (fromDev && arp.spa === arp.tpa && arp.spa !== "0.0.0.0") dev.gratuitousArpSeen = true;
            const gw = dev.dhcpGateway;
            if (gw) {
                if (arp.op === 1 && fromDev && arp.tpa === gw) {
                    dev.gwArpReq = true;
                    addEventPkt(dev, "arp_gw_req", makePktRef(packetIndex, pkt, ether, `ARP who-has ${gw}?`));
                }
                if (arp.op === 2 && !fromDev && arp.spa === gw && dstMac === vMac) {
                    dev.gwArpRes = true;
                    markStage(dev, "GATEWAY", pkt.ts);
                }
            }
        }
        return;
    }

    if (ether.type !== 0x0800) return;

    const ip = parseIpv4(pkt.data, ether.payloadOff);
    if (!ip) return;

    // IP fragmentation detection — read flags+offset from offset 6/7 of IP header.
    const fragField = (pkt.data[ether.payloadOff + 6] << 8) | pkt.data[ether.payloadOff + 7];
    const moreFrag = (fragField & 0x2000) !== 0;
    const fragOff = fragField & 0x1fff;
    if (moreFrag || fragOff !== 0) dev.ipv4FragmentCount++;

    if (fromDev) {
        dev.ipTrafficSeen = true;
        dev.lastSrcIp = ip.src;
        markStage(dev, "IP", pkt.ts);
        const prefix = dev.subnetMaskPrefix ?? 24;
        if (dev.ipv4) {
            if (!ipv4InSubnet(dev.ipv4, ip.dst, prefix) && !isMulticastIp(ip.dst) && ip.dst !== "255.255.255.255") {
                dev.offSubnetDestSeen = true;
                if (dev.dhcpGateway) markStage(dev, "GATEWAY", pkt.ts);
            }
        } else if (!isRfc1918(ip.dst) && !isMulticastIp(ip.dst)) {
            dev.offSubnetDestSeen = true;
            if (dev.dhcpGateway) markStage(dev, "GATEWAY", pkt.ts);
        }
    } else if (dstMac === vMac) {
        // Track inbound TTL distribution per source IP.
        const ttl = pkt.data[ether.payloadOff + 8];
        let set = dev.inboundTtls.get(ip.src);
        if (!set) { set = new Set(); dev.inboundTtls.set(ip.src, set); }
        set.add(ttl);
    }

    if (ip.proto === 1 && dstMac === vMac) {
        const ic = parseIcmp(pkt.data, ip.payloadOff);
        const icmpIpInfo = { src: ip.src, dst: ip.dst, proto: 1, ttl: pkt.data[ether.payloadOff + 8] };
        if (ic?.type === 3) {
            if (ic.code === 4) {
                dev.healthWarnings.add("MTU/PMTUD: ICMP Fragmentation Needed received.");
                addEventPkt(dev, "icmp_frag_needed", makePktRef(packetIndex, pkt, ether, "ICMP Fragmentation Needed", icmpIpInfo));
            }
            else if (ic.code === 9 || ic.code === 10 || ic.code === 13) {
                dev.healthWarnings.add("UPSTREAM POLICY: ICMP admin-prohibited received.");
                addEventPkt(dev, "icmp_prohibited", makePktRef(packetIndex, pkt, ether, "ICMP Administratively Prohibited", icmpIpInfo));
            }
            else if (ic.code === 0) dev.healthWarnings.add("REACHABILITY: ICMP Network Unreachable received.");
            else if (ic.code === 1) dev.healthWarnings.add("REACHABILITY: ICMP Host Unreachable received.");
            else if (ic.code === 3) dev.healthWarnings.add("REACHABILITY: ICMP Port Unreachable received.");
        } else if (ic?.type === 11) dev.healthWarnings.add("ROUTING: ICMP Time Exceeded (TTL=0) received — possible routing loop.");
    } else if (ip.proto === 2 && fromDev) {
        const ig = parseIgmp(pkt.data, ip.payloadOff, ip.payloadLen);
        if (ig) {
            if (ig.group && ig.type !== 0x17) dev.igmpGroupsJoined.add(ig.group);
            if (ig.v3Groups) ig.v3Groups.forEach(g => dev.igmpGroupsJoined.add(g));
        }
    }

    if (ip.proto === 17) processUdpv4(pkt, ether, ip, dev, fromDev, vMac, dstMac, cloudSuffixes, packetIndex);
    else if (ip.proto === 6) processTcpv4(pkt, ether, ip, dev, fromDev, vMac, dstMac, cloudSuffixes, packetIndex);
}

function processIpv6(
    pkt: RawPacket,
    ether: NonNullable<ReturnType<typeof parseEther>>,
    dev: DevState,
    fromDev: boolean,
    vMac: string,
    dstMac: string,
    cloudSuffixes: string[],
    shared: SharedState,
    _packetIndex: number,
) {
    const ip6 = parseIpv6(pkt.data, ether.payloadOff);
    if (!ip6) return;
    if (fromDev) {
        dev.ipv6TrafficSeen = true;
        if (!ip6.src.toLowerCase().startsWith("fe80")) dev.ipv6Addrs.add(ip6.src);
    }
    if (ip6.nextHeader === 58) {
        const ic = parseIcmpv6(pkt.data, ip6.payloadOff);
        if (ic) {
            if (ic.type === 134) shared.ipv6RaCount++;
            if (ic.type === 1 && dstMac === vMac) {
                if (ic.code === 1) dev.healthWarnings.add("ICMPv6: communication administratively prohibited received.");
                else if (ic.code === 3) dev.healthWarnings.add("ICMPv6: address unreachable received.");
                else if (ic.code === 4) dev.healthWarnings.add("ICMPv6: port unreachable received.");
            } else if (ic.type === 2 && dstMac === vMac) {
                dev.healthWarnings.add("ICMPv6: Packet Too Big — IPv6 path MTU mismatch.");
            }
        }
    } else if (ip6.nextHeader === 17) {
        const udp = parseUdp(pkt.data, ip6.payloadOff);
        if (udp) {
            if (udp.sport === 546 || udp.dport === 546 || udp.sport === 547 || udp.dport === 547) {
                dev.dhcpv6Seen = true;
            }
        }
    } else if (ip6.nextHeader === 6) {
        const tcp = parseTcp(pkt.data, ip6.payloadOff, ip6.payloadLen);
        if (!tcp) return;
        const remoteIp = fromDev ? ip6.dst : ip6.src;
        const remotePort = fromDev ? tcp.dport : tcp.sport;
        if (remotePort === 443) dev.tls443 = true;
        if (fromDev && (tcp.flags & TCP_SYN) && !(tcp.flags & TCP_ACK)) {
            if (dev.verkadaCloudIps.has(remoteIp)) {
                dev.cloudSynDests.add(`${remoteIp}:${remotePort}`);
                markStage(dev, "CLOUD_TCP", pkt.ts);
            }
        } else if (!fromDev && (tcp.flags & TCP_SYN) && (tcp.flags & TCP_ACK)) {
            if (dev.verkadaCloudIps.has(remoteIp)) {
                dev.cloudSynackDests.add(`${remoteIp}:${remotePort}`);
                markStage(dev, "CLOUD_TCP", pkt.ts);
            }
        }
    }
}

function processUdpv4(
    pkt: RawPacket,
    ether: NonNullable<ReturnType<typeof parseEther>>,
    ip: NonNullable<ReturnType<typeof parseIpv4>>,
    dev: DevState,
    fromDev: boolean,
    vMac: string,
    dstMac: string,
    cloudSuffixes: string[],
    packetIndex: number,
) {
    const udp = parseUdp(pkt.data, ip.payloadOff);
    if (!udp) return;

    if (udp.sport === 123 || udp.dport === 123) {
        if (fromDev) {
            dev.ntpSent = true; dev.ntpServers.add(ip.dst);
            addEventPkt(dev, "ntp_request", makePktRef(packetIndex, pkt, ether, `NTP request to ${ip.dst}`, { src: ip.src, dst: ip.dst, proto: 17, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: udp.sport, dstPort: udp.dport }));
        }
        else if (dstMac === vMac) { dev.ntpRcvd = true; dev.ntpServers.add(ip.src); markStage(dev, "TIME", pkt.ts); }
    }
    if (udp.sport === 5353 || udp.dport === 5353) {
        dev.mdnsSeen = true;
        if (fromDev) dev.mdnsQueryCount++;
    }
    if (udp.sport === 1900 || udp.dport === 1900) dev.ssdpSeen = true;
    if (udp.sport === 5355 || udp.dport === 5355) dev.llmnrSeen = true;
    // STUN/TURN — any UDP, but cheap to test for the magic cookie.
    if (fromDev && isStunMessage(pkt.data, udp.payloadOff, udp.payloadLen)) dev.stunSeen = true;

    if (udp.sport === 67 || udp.dport === 67 || udp.sport === 68 || udp.dport === 68) {
        const dhcp = parseDhcp(pkt.data, udp.payloadOff, udp.payloadLen);
        if (dhcp) {
            if (dhcp.giaddr || dhcp.relayAgentInfoPresent) dev.dhcpRelayObserved = true;
            if (dhcp.messageType === 1 && fromDev) {
                dev.dhcpDiscoverCount++;
                if (dhcp.xid !== undefined) dev.dhcpDiscoverTs.set(dhcp.xid, pkt.ts);
                addEventPkt(dev, "dhcp_discover", makePktRef(packetIndex, pkt, ether, "DHCP Discover", { src: ip.src, dst: ip.dst, proto: 17, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: udp.sport, dstPort: udp.dport }));
            }
            if (dhcp.messageType === 3 && fromDev) {
                dev.dhcpRequestCount++;
                if (dhcp.xid !== undefined) dev.dhcpRequestTs.set(dhcp.xid, pkt.ts);
            }
            if (dhcp.messageType === 4 && fromDev) {
                dev.dhcpDeclineSeen = true;
                addEventPkt(dev, "dhcp_decline", makePktRef(packetIndex, pkt, ether, "DHCP Decline", { src: ip.src, dst: ip.dst, proto: 17, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: udp.sport, dstPort: udp.dport }));
            }
            if (dhcp.messageType === 2 && dstMac === vMac && dhcp.xid !== undefined) {
                const t0 = dev.dhcpDiscoverTs.get(dhcp.xid);
                if (t0 !== undefined && (dev.dhcpOfferLatencyMs === null || pkt.ts - t0 < dev.dhcpOfferLatencyMs / 1000)) {
                    dev.dhcpOfferLatencyMs = (pkt.ts - t0) * 1000;
                }
            }
            if (dhcp.messageType === 5 && dstMac === vMac) {
                dev.dhcpAckSeen = true;
                if (dhcp.yiaddr) dev.ipv4 = dhcp.yiaddr;
                if (dhcp.router) dev.dhcpGateway = dhcp.router;
                if (dhcp.subnetMaskPrefix !== undefined) dev.subnetMaskPrefix = dhcp.subnetMaskPrefix;
                if (dhcp.dns) {
                    dev.dhcpDns = dhcp.dns;
                    dhcp.dns.forEach(d => dev.dnsServersObserved.add(d));
                }
                if (dhcp.serverId) dev.dhcpServerIds.add(dhcp.serverId);
                if (dhcp.leaseTime) dev.dhcpLeaseTime = dhcp.leaseTime;
                markStage(dev, "IP", pkt.ts);
                if (dhcp.xid !== undefined) {
                    const t0 = dev.dhcpRequestTs.get(dhcp.xid);
                    if (t0 !== undefined) dev.dhcpAckLatencyMs = (pkt.ts - t0) * 1000;
                }
            }
            if (dhcp.messageType === 2 && dhcp.serverId) dev.dhcpServerIds.add(dhcp.serverId);
            if (dhcp.messageType === 6 && dstMac === vMac) {
                dev.dhcpNakSeen = true;
                addEventPkt(dev, "dhcp_nak", makePktRef(packetIndex, pkt, ether, "DHCP NAK", { src: ip.src, dst: ip.dst, proto: 17, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: udp.sport, dstPort: udp.dport }));
            }
            if (fromDev) {
                if (dhcp.vendorClass) dev.dhcpVendorClass = dhcp.vendorClass;
                if (dhcp.hostName) dev.dhcpHostName = dhcp.hostName;
            }
        }
    }

    const isDnsPort = (udp.sport === 53 || udp.dport === 53);
    if (isDnsPort || udp.sport === 5353 || udp.dport === 5353) {
        const dns = parseDns(pkt.data, udp.payloadOff, udp.payloadLen);
        if (dns) {
            if (dns.qr === 0 && fromDev && dns.qname) {
                const qn = dns.qname.toLowerCase();
                dev.dnsQueries.add(qn);
                if (isDnsPort) {
                    dev.dnsUdp53QueriesCount++;
                    dev.dnsQueryTs.set(dns.txid, pkt.ts);
                    let variants = dev.dnsCaseVariants.get(qn);
                    if (!variants) { variants = new Set(); dev.dnsCaseVariants.set(qn, variants); }
                    variants.add(dns.qname);
                }
                if (isVerkadaHostname(qn, cloudSuffixes)) dev.dnsVerkadaQueries.add(qn);
            } else if (dns.qr === 1 && dstMac === vMac) {
                if (isDnsPort) {
                    dev.dnsServersObserved.add(ip.src);
                    dev.dnsRcodeCounts.set(dns.rcode, (dev.dnsRcodeCounts.get(dns.rcode) ?? 0) + 1);
                    if (dns.rcode !== 0) {
                        addEventPkt(dev, "dns_error", makePktRef(packetIndex, pkt, ether, `DNS ${rcodeName(dns.rcode)} for ${dns.qname ?? "?"}`, { src: ip.src, dst: ip.dst, proto: 17, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: udp.sport, dstPort: udp.dport }));
                    }
                    const t0 = dev.dnsQueryTs.get(dns.txid);
                    if (t0 !== undefined) {
                        dev.dnsResponseLatencyMs.push((pkt.ts - t0) * 1000);
                        dev.dnsQueryTs.delete(dns.txid);
                    }
                }
                if (dns.rcode === 0 && dns.ancount > 0) {
                    dev.dnsSuccessCount++;
                    if (isDnsPort) markStage(dev, "DNS", pkt.ts);
                    const qn = dns.qname.toLowerCase();
                    const qIsVerkada = isVerkadaHostname(qn, cloudSuffixes);
                    for (const ans of dns.answers) {
                        const isA = ans.type === 1 && typeof ans.rdata === "string";
                        const isAaaa = ans.type === 28 && typeof ans.rdata === "string";
                        if (!isA && !isAaaa) continue;
                        const ipStr = ans.rdata!;
                        let perHost = dev.dnsResolvedByHost.get(qn);
                        if (!perHost) { perHost = new Set(); dev.dnsResolvedByHost.set(qn, perHost); }
                        perHost.add(ipStr);
                        if (qIsVerkada) {
                            dev.verkadaCloudIps.add(ipStr);
                            if (ans.ttl < 30 && ans.ttl > 0) dev.verkadaShortTtlSeen = true;
                            if (isA) {
                                const cls = classifySuspiciousAnswer(ipStr);
                                if (cls) dev.dnsHijackWarn = `(DNS HIJACK: ${qn} -> ${ipStr}, ${cls})`;
                            }
                        }
                    }
                }
            }
        }
    }
    if (udp.dport === 853 || udp.sport === 853) dev.dotSeen = true;
}

function processTcpv4(
    pkt: RawPacket,
    ether: NonNullable<ReturnType<typeof parseEther>>,
    ip: NonNullable<ReturnType<typeof parseIpv4>>,
    dev: DevState,
    fromDev: boolean,
    vMac: string,
    dstMac: string,
    cloudSuffixes: string[],
    packetIndex: number,
) {
    const tcp = parseTcp(pkt.data, ip.payloadOff, ip.payloadLen);
    if (!tcp) return;

    const remoteIp = fromDev ? ip.dst : ip.src;
    const remotePort = fromDev ? tcp.dport : tcp.sport;
    const remoteKey = `${remoteIp}:${remotePort}`;
    const localPort = fromDev ? tcp.sport : tcp.dport;
    const flowKey = fromDev
        ? `${ip.src}:${tcp.sport}>${ip.dst}:${tcp.dport}`
        : `${ip.dst}:${tcp.dport}>${ip.src}:${tcp.sport}`;

    if (remotePort === 443) dev.tls443 = true;
    if (remotePort === 554) dev.rtspSeen = true;
    if (remotePort === 853 || localPort === 853) dev.dotSeen = true;
    if (remotePort === 443 && fromDev && KNOWN_DOH_IPV4.has(remoteIp)) dev.dohSeen = true;

    if (VERKADA_LOCAL_TCP_PORTS.has(remotePort) || VERKADA_LOCAL_TCP_PORTS.has(localPort)) {
        const isSyn = (tcp.flags & TCP_SYN) !== 0;
        const isAck = (tcp.flags & TCP_ACK) !== 0;
        if (isSyn && !isAck) {
            if (fromDev && VERKADA_LOCAL_TCP_PORTS.has(remotePort)) dev.local4100AsClient = true;
            if (!fromDev && VERKADA_LOCAL_TCP_PORTS.has(localPort)) dev.local4100AsServer = true;
        } else if (VERKADA_LOCAL_TCP_PORTS.has(localPort) && !fromDev) dev.local4100AsServer = true;
    }

    // Plaintext HTTP detection.
    if (fromDev && remotePort === 80 && tcp.payloadLen > 0) {
        if (looksLikeHttpRequest(pkt.data, tcp.payloadOff, tcp.payloadLen) && !isRfc1918(remoteIp)) {
            dev.plaintextHttpInternetCount++;
        }
    }

    const isSyn = (tcp.flags & TCP_SYN) !== 0;
    const isAck = (tcp.flags & TCP_ACK) !== 0;
    const isRst = (tcp.flags & TCP_RST) !== 0;
    const isFin = (tcp.flags & TCP_FIN) !== 0;

    if (fromDev && isSyn && !isAck) {
        dev.synTimes.set(remoteKey, pkt.ts);
        dev.cloudSynCount.set(remoteKey, (dev.cloudSynCount.get(remoteKey) ?? 0) + 1);
        dev.tcpSynFromDev++;
        if (dev.verkadaCloudIps.has(remoteIp)) {
            dev.cloudSynDests.add(remoteKey);
            addEventPkt(dev, "cloud_syn", makePktRef(packetIndex, pkt, ether, `TCP SYN to cloud ${remoteKey}`, { src: ip.src, dst: ip.dst, proto: 6, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: tcp.sport, dstPort: tcp.dport, flags: tcpFlagsStr(tcp.flags) }));
        }
    } else if (!fromDev && isSyn && isAck) {
        const t0 = dev.synTimes.get(remoteKey);
        if (t0 !== undefined) {
            dev.rttSamplesMs.push((pkt.ts - t0) * 1000);
            dev.synTimes.delete(remoteKey);
        }
        dev.tcpSynAckFromNet++;
        if (dev.verkadaCloudIps.has(remoteIp)) {
            dev.cloudSynackDests.add(remoteKey);
            markStage(dev, "CLOUD_TCP", pkt.ts);
            dev.cloudSynAckCount++;
            captureCloudTcpOptions(dev, tcp);
        } else if (remotePort === 443 && isRfc1918(remoteIp) && remoteIp !== dev.dhcpGateway) {
            // Likely Command Connector local TLS.
            dev.commandConnectorDests.add(remoteKey);
        }
    }
    // Also capture TCP options on the originating SYN from device.
    if (fromDev && isSyn && !isAck && dev.verkadaCloudIps.has(remoteIp)) {
        captureCloudTcpOptions(dev, tcp);
    }

    if (isRst) {
        const rstIp = { src: ip.src, dst: ip.dst, proto: 6, ttl: pkt.data[ether.payloadOff + 8] };
        const rstTcp = { srcPort: tcp.sport, dstPort: tcp.dport, flags: tcpFlagsStr(tcp.flags) };
        if (fromDev) {
            dev.tcpRstFromDev = true;
            addEventPkt(dev, "tcp_rst_from_dev", makePktRef(packetIndex, pkt, ether, `TCP RST from device (→${remoteKey})`, rstIp, rstTcp));
        } else {
            dev.tcpRstFromNet = true;
            addEventPkt(dev, "tcp_rst_from_net", makePktRef(packetIndex, pkt, ether, `TCP RST from network (${remoteKey})`, rstIp, rstTcp));
        }
    }

    if (tcp.window === 0 && (remotePort === 443 || VERKADA_LOCAL_TCP_PORTS.has(remotePort) || VERKADA_LOCAL_TCP_PORTS.has(localPort))) {
        dev.healthWarnings.add("FLOW CONTROL: TCP Zero Window observed.");
    }

    const cloudBound = dev.verkadaCloudIps.has(remoteIp) || dev.commandConnectorDests.has(remoteKey)
        || (remotePort === 443 && setToArray(dev.sniHostnames).some(s => isVerkadaHostname(s, cloudSuffixes)));

    if (cloudBound) {
        let stats = dev.cloudFlows.get(flowKey);
        if (!stats) {
            stats = {
                devBytes: 0, netBytes: 0, firstTs: pkt.ts, lastTs: pkt.ts, closedTs: null,
                appDataFromDev: 0, appDataFromNet: 0,
                clientHelloTs: null, firstAppDataTs: null,
            };
            dev.cloudFlows.set(flowKey, stats);
        }
        if (fromDev) stats.devBytes += tcp.payloadLen; else stats.netBytes += tcp.payloadLen;
        stats.lastTs = pkt.ts;
        if ((isFin || isRst) && stats.closedTs === null) stats.closedTs = pkt.ts;

        if (tcp.payloadLen > 0) {
            let seqs = dev.cloudFlowSeqs.get(flowKey);
            if (!seqs) { seqs = new Set(); dev.cloudFlowSeqs.set(flowKey, seqs); }
            if (seqs.has(tcp.seq)) dev.tcpRetransToCloud++;
            else seqs.add(tcp.seq);
        }

        // Duplicate-ACK detection: pure-ACK (no payload) with same ack number 3+ times in a row.
        if (tcp.payloadLen === 0 && isAck && !isSyn && !isRst && !isFin) {
            let st = dev.cloudFlowDupAcks.get(flowKey);
            if (!st) { st = { lastAck: tcp.ack, repeats: 0 }; dev.cloudFlowDupAcks.set(flowKey, st); }
            else if (st.lastAck === tcp.ack) {
                st.repeats++;
                if (st.repeats === 3) dev.cloudDupAckCount++;
            } else { st.lastAck = tcp.ack; st.repeats = 0; }
        }
    }

    if (remotePort === 443 && tcp.payloadLen > 0) {
        const payload = pkt.data.subarray(tcp.payloadOff, tcp.payloadOff + tcp.payloadLen);
        const { alerts, appDataCount } = parseTlsAlertsAndRecords(payload);
        for (const code of alerts) {
            dev.tlsAlerts.add(TLS_ALERTS[code] ?? `code_${code}`);
            if (code === 42) {
                dev.badCertDetected = true;
                addEventPkt(dev, "tls_bad_cert", makePktRef(packetIndex, pkt, ether, "TLS Alert: bad_certificate (42)", { src: ip.src, dst: ip.dst, proto: 6, ttl: pkt.data[ether.payloadOff + 8] }, { srcPort: tcp.sport, dstPort: tcp.dport, flags: tcpFlagsStr(tcp.flags) }));
            }
        }
        if (appDataCount > 0 && cloudBound) {
            const stats = dev.cloudFlows.get(flowKey);
            if (stats) {
                if (fromDev) stats.appDataFromDev += appDataCount;
                else stats.appDataFromNet += appDataCount;
                if (stats.firstAppDataTs === null) stats.firstAppDataTs = pkt.ts;
            }
            dev.cloudTlsApplicationDataSeen = true;
            if (dev.verkadaCloudIps.has(remoteIp)) markStage(dev, "CLOUD_TLS", pkt.ts);
        }
        if (fromDev) {
            const ch = parseTlsClientHello(payload);
            if (ch) {
                if (ch.sni) {
                    dev.sniHostnames.add(ch.sni);
                    let set = dev.sniToDestIps.get(ch.sni);
                    if (!set) { set = new Set(); dev.sniToDestIps.set(ch.sni, set); }
                    set.add(ip.dst);
                    if (isVerkadaHostname(ch.sni, cloudSuffixes)) dev.verkadaCloudIps.add(ip.dst);
                }
                if (ch.versions.length) {
                    if (ch.versionsFromExtension) dev.tlsVersionsViaExtension = true;
                    ch.versions.forEach(v => { if (!isTlsGreaseValue(v)) dev.tlsVersionsObserved.add(v); });
                }
                if (ch.alpn) ch.alpn.forEach(a => dev.tlsAlpns.add(a));
                const stats = dev.cloudFlows.get(flowKey);
                if (stats && stats.clientHelloTs === null) stats.clientHelloTs = pkt.ts;
            }
        }
    }
}

function captureCloudTcpOptions(dev: DevState, tcp: TcpHdr) {
    if (tcp.options.mss !== undefined) {
        if (dev.cloudMinMss === null || tcp.options.mss < dev.cloudMinMss) dev.cloudMinMss = tcp.options.mss;
    }
    if (tcp.options.wscale !== undefined) {
        dev.cloudWscaleObserved = true;
        if (tcp.options.wscale > dev.cloudMaxWscale) dev.cloudMaxWscale = tcp.options.wscale;
    }
    if (tcp.options.sackPerm) dev.cloudSackPermObserved = true;
    if (tcp.options.timestamps) dev.cloudTimestampsObserved = true;
}

// ============================================================================
// Capture-quality notes
// ============================================================================

function buildCaptureNotes(args: {
    firstTs: number | null; lastTs: number | null;
    truncated: number; totalPkts: number;
    devices: DeviceReport[]; anyBidirectional: boolean;
    broadcastPct: number; snaplen: number | null;
    duplicatedFrameCount: number; spanReversedDeviceCount: number;
    cdpTrunkPdusSeen: boolean;
}): string[] {
    const notes: string[] = [];
    const duration = (args.firstTs !== null && args.lastTs !== null) ? args.lastTs - args.firstTs : 0;
    if (duration > 0 && duration < 5 && args.devices.length > 0) {
        notes.push(`Capture spans only ${duration.toFixed(1)} s; diagnoses that require waiting for responses (NTP, cloud SYN-ACK) are weakly supported.`);
    }
    if (args.truncated > 0 && args.totalPkts > 0) {
        const pct = (args.truncated / args.totalPkts) * 100;
        if (pct > 1) notes.push(`${args.truncated.toLocaleString()} of ${args.totalPkts.toLocaleString()} frames (${pct.toFixed(1)}%) were truncated by the capture's snaplen — TLS alerts and other late-record data may be cut off.`);
    }
    if (args.snaplen !== null && args.snaplen <= 160) {
        notes.push(`Largest captured frame is ${args.snaplen} bytes — looks like a header-only snaplen. Deep-payload inspection (TLS alerts, ClientHello SNI) is not possible from this capture.`);
    }
    if (args.devices.length > 0 && !args.anyBidirectional) {
        notes.push("No Verkada device appeared as a packet source — this looks like a one-directional capture. Findings that depend on observing device-originated traffic (DHCP DISCOVER, DNS queries, ARP requests) may be incomplete.");
    }
    if (args.spanReversedDeviceCount > 0) {
        notes.push(`${args.spanReversedDeviceCount} device(s) showed only inbound TCP handshakes (SYN-ACKs without preceding SYNs) — this suggests the SPAN/mirror session is configured to mirror the wrong direction.`);
    }
    if (args.duplicatedFrameCount > Math.max(50, args.totalPkts * 0.01)) {
        notes.push(`${args.duplicatedFrameCount} frames appeared in duplicate within sub-millisecond windows — the SPAN session likely has both ingress and egress mirroring enabled. Retransmission counts are inflated.`);
    }
    if (args.broadcastPct > 30) {
        notes.push(`${args.broadcastPct.toFixed(1)}% of frames were broadcast or multicast — this is high; the segment is unusually chatty and ARP/MAC caches on cameras can thrash.`);
    }
    if (args.cdpTrunkPdusSeen) {
        notes.push("DTP/VTP/PVSTP+ frames observed — the access port appears to be trunking. Cameras should live on access ports; trunking can confuse the device about which VLAN it's on.");
    }
    return notes;
}

// ============================================================================
// Connection-stage tracker
// ============================================================================

function computeStage(d: DevState): StageProgress {
    const reached: Stage[] = [];
    if (d.matchedAsSrc) reached.push("LINK");
    if (!d.eapolSeen || d.eapSuccess) reached.push("AUTH");
    if (d.dhcpAckSeen || d.ipv4 || d.ipTrafficSeen) reached.push("IP");
    if (d.gwArpRes || d.offSubnetDestSeen) reached.push("GATEWAY");
    if (d.dnsSuccessCount > 0) reached.push("DNS");
    if (d.ntpRcvd) reached.push("TIME");
    if (d.cloudSynackDests.size > 0) reached.push("CLOUD_TCP");

    // CLOUD_TLS requires at least one application_data record in each direction on a cloud flow
    // (server hello / certificate / finished alone don't prove the session is usable).
    let cloudTls = false;
    d.cloudFlows.forEach(s => {
        if (s.appDataFromDev > 0 && s.appDataFromNet > 0) cloudTls = true;
    });
    if (cloudTls) reached.push("CLOUD_TLS");

    // ESTABLISHED: at least one cloud flow with sustained app data (≥30 s of life, ≥10 records each way).
    let established = false;
    d.cloudFlows.forEach(s => {
        const life = (s.closedTs ?? s.lastTs) - (s.firstTs);
        if (s.appDataFromDev >= 5 && s.appDataFromNet >= 5 && life >= 30) established = true;
    });
    if (established) reached.push("ESTABLISHED");

    const reachedSet = new Set(reached);
    const ordered: Stage[] = STAGE_ORDER.filter(s => reachedSet.has(s));
    let blockedAt: Stage | null = null;
    for (const s of STAGE_ORDER) {
        if (!reachedSet.has(s)) { blockedAt = s; break; }
    }
    return { reached: ordered, blockedAt, completed: blockedAt === null, timings: d.stageTimings };
}

// ============================================================================
// Structured (technical) report
// ============================================================================

function buildReport(d: DevState, shared: SharedState, cloudSuffixes: string[]): ReportLine[] {
    const out: ReportLine[] = [];

    const peerBits: string[] = [];
    if (shared.lldpPeers.size) peerBits.push(`LLDP: ${setToArray(shared.lldpPeers).sort().join("; ")}`);
    if (shared.cdpPeers.size) peerBits.push(`CDP: ${setToArray(shared.cdpPeers).sort().join("; ")}`);
    if (peerBits.length) out.push({ category: "L2 NEIGHBOR", severity: "NEUTRAL", text: peerBits.join(" | ") });
    else out.push({ category: "L2 NEIGHBOR", severity: "INFO", text: "No LLDP/CDP observed (switch may not advertise, or capture started after TX)." });

    if (shared.lldpSysDescs.size) {
        out.push({ category: "L2 NEIGHBOR", severity: "NEUTRAL", text: `Switch system description: ${setToArray(shared.lldpSysDescs).slice(0, 2).join(" | ").slice(0, 240)}` });
    }
    if (shared.bpduRoots.size) {
        out.push({ category: "L2 STP", severity: "NEUTRAL", text: `STP root bridge(s): ${setToArray(shared.bpduRoots).sort().join(", ")}` });
    }

    if (d.pseMedPoe || d.pdMedPoe) {
        const bits: string[] = [];
        if (d.pseMedPoe) bits.push(`PSE offers ${d.pseMedPoe.powerW.toFixed(1)} W (${d.pseMedPoe.powerPriority} priority)`);
        if (d.pdMedPoe) bits.push(`PD requests ${d.pdMedPoe.powerW.toFixed(1)} W`);
        out.push({ category: "POE", severity: "NEUTRAL", text: bits.join(" / ") + "." });
    }

    if (d.medPolicy) {
        const p = d.medPolicy;
        out.push({ category: "L2 POLICY", severity: "NEUTRAL", text: `LLDP-MED Network Policy: app=${p.appType}, ${p.tagged ? `VLAN ${p.vlanId} tagged` : "untagged"}, priority ${p.l2Priority}, DSCP ${p.dscp}.` });
    }

    if (d.vlansSeen.size) {
        const v = setToArray(d.vlansSeen).sort((a, b) => a - b);
        out.push({ category: "L2 VLAN", severity: "NEUTRAL", text: `802.1Q tags observed on device traffic: [${v.join(", ")}]` });
    }

    if (d.mdnsSeen) out.push({ category: "L2 DISCOVERY", severity: "NEUTRAL", text: "mDNS traffic from device present." });
    else out.push({ category: "L2 DISCOVERY", severity: "INFO", text: "No mDNS from device (segment may suppress multicast, or device hasn't reached discovery)." });

    if (d.ssdpSeen) out.push({ category: "L2 DISCOVERY", severity: "INFO", text: "SSDP traffic observed (legacy discovery)." });
    if (d.llmnrSeen) out.push({ category: "L2 DISCOVERY", severity: "INFO", text: "LLMNR traffic observed (legacy resolution)." });

    if (d.igmpGroupsJoined.size) {
        out.push({ category: "L3 MULTICAST", severity: "NEUTRAL", text: `IGMP membership reports for: [${setToArray(d.igmpGroupsJoined).sort().join(", ")}]` });
    }

    if (d.eapolSeen) {
        if (d.eapFailure) out.push({ category: "802.1X", severity: "CRITICAL", text: "EAP Failure — port-auth rejected device." });
        else if (d.eapSuccess) out.push({ category: "802.1X", severity: "PASS", text: "EAP Success — port-auth completed." });
        else out.push({ category: "802.1X", severity: "INFO", text: "EAPOL frames present; no Success/Failure observed in capture." });
    }

    if (d.dhcpAckSeen) {
        const lease = d.dhcpLeaseTime ? ` lease ${d.dhcpLeaseTime}s` : "";
        const srv = d.dhcpServerIds.size ? ` from ${setToArray(d.dhcpServerIds).sort().join(", ")}` : "";
        const mask = d.subnetMaskPrefix !== null ? `/${d.subnetMaskPrefix}` : "";
        const relay = d.dhcpRelayObserved ? " (via relay)" : "";
        out.push({
            category: "IP ADDRESSING", severity: "PASS",
            text: `DHCP ACK -> ${d.ipv4}${mask} (GW: ${d.dhcpGateway}, DNS: [${d.dhcpDns.join(", ")}])${srv}${lease}${relay}.`,
        });
        if (d.dhcpOfferLatencyMs !== null) {
            out.push({ category: "IP ADDRESSING", severity: "NEUTRAL", text: `DHCP DISCOVER → OFFER latency: ${d.dhcpOfferLatencyMs.toFixed(0)} ms.` });
        }
        if (d.dhcpAckLatencyMs !== null) {
            out.push({ category: "IP ADDRESSING", severity: "NEUTRAL", text: `DHCP REQUEST → ACK latency: ${d.dhcpAckLatencyMs.toFixed(0)} ms.` });
        }
    } else if (d.ipTrafficSeen) {
        out.push({ category: "IP ADDRESSING", severity: "INFO", text: `No DHCP in capture; device active at ${d.lastSrcIp} (static or pre-existing lease).` });
    } else if (d.matchedAsSrc) {
        out.push({ category: "IP ADDRESSING", severity: "CRITICAL", text: "No IP traffic — device dark at L3." });
    } else {
        out.push({ category: "IP ADDRESSING", severity: "WARNING", text: "Device matched only as a frame destination — no transmissions from this MAC observed." });
    }

    if (d.dhcpNakSeen) out.push({ category: "IP ADDRESSING", severity: "CRITICAL", text: "DHCP NAK received — server rejected the request." });
    if (d.dhcpDeclineSeen) out.push({ category: "IP ADDRESSING", severity: "CRITICAL", text: "DHCP DECLINE sent by device — likely IP address conflict on the offered lease." });
    if (d.dhcpServerIds.size >= 2) out.push({ category: "IP ADDRESSING", severity: "WARNING", text: `Multiple DHCP server IDs observed (${setToArray(d.dhcpServerIds).sort().join(", ")}) — possible rogue DHCP.` });
    if (d.dhcpDiscoverCount >= 2) out.push({ category: "STABILITY", severity: "WARNING", text: `${d.dhcpDiscoverCount} DHCP DISCOVERs observed (possible reboot loop or lease loss).` });
    if (d.dhcpLeaseTime !== null && d.dhcpLeaseTime > 0 && d.dhcpLeaseTime < 300) {
        out.push({ category: "STABILITY", severity: "WARNING", text: `DHCP lease time very short (${d.dhcpLeaseTime}s) — unusual for camera deployments.` });
    }

    if (d.ipv4FragmentCount > 0) {
        out.push({ category: "IP", severity: "WARNING", text: `${d.ipv4FragmentCount} IPv4 fragmented packet(s) seen — path MTU is being exceeded somewhere.` });
    }

    if (d.ipv6TrafficSeen || d.dhcpv6Seen) {
        const bits: string[] = [];
        if (d.ipv6TrafficSeen) bits.push(`IPv6 source addrs: [${setToArray(d.ipv6Addrs).join(", ") || "link-local only"}]`);
        if (d.dhcpv6Seen) bits.push("DHCPv6 traffic observed");
        out.push({ category: "IPv6", severity: "INFO", text: bits.join(" · ") + "." });
    }

    if (d.dhcpGateway) {
        if (d.gwArpReq && d.gwArpRes) out.push({ category: "ROUTING", severity: "PASS", text: `ARP to gateway ${d.dhcpGateway} answered.` });
        else if (d.gwArpReq) out.push({ category: "ROUTING", severity: "WARNING", text: `ARP for gateway ${d.dhcpGateway} sent, no reply captured (unicast reply may be hidden by SPAN).` });
        else if (d.ipTrafficSeen) out.push({ category: "ROUTING", severity: "INFO", text: "Gateway ARP not seen, but outbound IP present — gateway implicitly reachable." });
    } else {
        out.push({ category: "ROUTING", severity: "INFO", text: "No DHCP-learned gateway; gateway ARP not evaluated." });
    }

    if (d.ipClaims.size) {
        const conflicts: string[] = [];
        d.ipClaims.forEach((macs, ip) => { if (macs.size > 1) conflicts.push(`${ip}=[${setToArray(macs).join(", ")}]`); });
        if (conflicts.length) out.push({ category: "ROUTING", severity: "CRITICAL", text: `IP/MAC conflict detected: ${conflicts.join("; ")}.` });
    }

    // TTL variance
    const ttlVariances: string[] = [];
    d.inboundTtls.forEach((set, src) => {
        if (set.size > 1) {
            const arr = setToArray(set).sort((a, b) => a - b);
            if (arr[arr.length - 1] - arr[0] > 4) ttlVariances.push(`${src} TTLs [${arr.join(",")}]`);
        }
    });
    if (ttlVariances.length) out.push({ category: "ROUTING", severity: "WARNING", text: `Inbound TTL variance: ${ttlVariances.slice(0, 3).join("; ")}${ttlVariances.length > 3 ? "; …" : ""} — path may be changing mid-capture.` });

    if (d.dnsServersObserved.size >= 2) out.push({ category: "DNS", severity: "INFO", text: `Multiple distinct DNS servers observed: [${setToArray(d.dnsServersObserved).sort().join(", ")}]` });
    if (d.dnsResponseLatencyMs.length >= 3) {
        const med = median(d.dnsResponseLatencyMs);
        const worst = Math.max(...d.dnsResponseLatencyMs);
        out.push({ category: "DNS", severity: "NEUTRAL", text: `DNS response latency: median ${med.toFixed(0)} ms, worst ${worst.toFixed(0)} ms over ${d.dnsResponseLatencyMs.length} sample(s).` });
    }
    if (d.dnsRcodeCounts.size) {
        const parts: string[] = [];
        d.dnsRcodeCounts.forEach((n, code) => parts.push(`${rcodeName(code)}=${n}`));
        out.push({ category: "DNS", severity: "NEUTRAL", text: `Response codes: ${parts.sort().join(", ")}` });
    }
    if (d.dnsUdp53QueriesCount > 0 || d.dnsSuccessCount > 0) {
        if (d.dnsSuccessCount > 0) {
            const note = d.dnsHijackWarn ? ` ${d.dnsHijackWarn}` : "";
            out.push({ category: "DNS", severity: "PASS", text: `${d.dnsSuccessCount} valid response(s).${note}` });
        } else if (d.dnsUdp53QueriesCount > 0) {
            out.push({ category: "DNS", severity: "CRITICAL", text: "Queries sent, zero valid answers (NXDOMAIN/no-answer/timeout). Check UDP/53 path." });
        }
        if (d.dnsVerkadaQueries.size) out.push({ category: "DNS", severity: "NEUTRAL", text: `Verkada hostnames queried: [${setToArray(d.dnsVerkadaQueries).sort().join(", ")}]` });
    } else if (d.mdnsQueryCount > 0) {
        out.push({ category: "DNS", severity: "INFO", text: `${d.mdnsQueryCount} mDNS query/queries from device, but no UDP/53 DNS yet.` });
    }
    if (d.verkadaShortTtlSeen) out.push({ category: "DNS", severity: "WARNING", text: "Suspiciously short TTL (<30s) on a Verkada-hostname answer — could indicate cache poisoning or a transparent DNS rewriter." });

    // 0x20 case-randomization: any name where we saw more than 5 mixed-case variants from the device.
    const randomized: string[] = [];
    d.dnsCaseVariants.forEach((variants, name) => { if (variants.size >= 6) randomized.push(`${name} (${variants.size} variants)`); });
    if (randomized.length) out.push({ category: "DNS", severity: "INFO", text: `0x20 case-randomization detected: ${randomized.slice(0, 3).join("; ")}.` });

    if (d.dohSeen) out.push({ category: "DNS", severity: "WARNING", text: "TCP/443 traffic observed to a known public DNS-over-HTTPS endpoint — camera's DNS may be overridden." });
    if (d.dotSeen) out.push({ category: "DNS", severity: "WARNING", text: "DNS-over-TLS (TCP/853) traffic observed." });

    if (d.sniHostnames.size) {
        out.push({ category: "TLS", severity: "NEUTRAL", text: `SNI hostnames observed: [${setToArray(d.sniHostnames).sort().join(", ")}]` });
    }
    {
        const usable: number[] = [];
        d.tlsVersionsObserved.forEach(v => {
            if (isTlsGreaseValue(v)) return;
            if (d.tlsVersionsViaExtension && v === 0x0303) return;
            usable.push(v);
        });
        if (usable.length) {
            usable.sort((a, b) => a - b);
            out.push({ category: "TLS", severity: "NEUTRAL", text: `TLS versions offered: [${usable.map(tlsVersionName).join(", ")}]` });
            if (usable.some(v => v === 0x0301 || v === 0x0302) && d.tlsVersionsViaExtension) {
                out.push({ category: "TLS", severity: "WARNING", text: "Camera advertised TLS 1.0 or 1.1 in supported_versions — old crypto." });
            }
        }
    }
    if (d.tlsAlpns.size) out.push({ category: "TLS", severity: "NEUTRAL", text: `ALPN: [${setToArray(d.tlsAlpns).sort().join(", ")}]` });

    if (d.cloudSynDests.size) {
        const unanswered: string[] = [];
        d.cloudSynDests.forEach(k => { if (!d.cloudSynackDests.has(k)) unanswered.push(k); });
        if (unanswered.length) out.push({ category: "CLOUD", severity: "CRITICAL", text: `SYN to Verkada cloud unanswered (${unanswered.sort().join(", ")}).` });
        else out.push({ category: "CLOUD", severity: "PASS", text: `SYN+SYN-ACK to all ${d.cloudSynDests.size} Verkada cloud endpoint(s).` });
    } else if (d.dnsVerkadaQueries.size && d.sniHostnames.size === 0) {
        out.push({ category: "CLOUD", severity: "WARNING", text: "Verkada hostnames resolved but no TCP SYN to cloud captured." });
    }

    let cloudDevBytes = 0, cloudNetBytes = 0;
    d.cloudFlows.forEach(s => { cloudDevBytes += s.devBytes; cloudNetBytes += s.netBytes; });
    if (cloudDevBytes + cloudNetBytes > 0) {
        out.push({ category: "CLOUD", severity: "NEUTRAL", text: `Cloud bytes: ${formatBytes(cloudDevBytes)} up / ${formatBytes(cloudNetBytes)} down across ${d.cloudFlows.size} flow(s).` });
    }

    // TCP-option diagnostics (only if we have at least one cloud SYN-ACK).
    if (d.cloudSynAckCount > 0) {
        if (d.cloudMinMss !== null && d.cloudMinMss < 1460) {
            out.push({ category: "TCP OPTIONS", severity: "WARNING", text: `TCP MSS clamped to ${d.cloudMinMss} (standard Ethernet is 1460) — there is a tunnel / VPN / MSS-clamping firewall in the path.` });
        }
        if (d.cloudWscaleObserved && d.cloudMaxWscale === 0) {
            out.push({ category: "TCP OPTIONS", severity: "WARNING", text: "TCP window scale negotiated as 0 — receive window capped at 64 KB regardless of RTT. Throughput will suffer on high-latency paths." });
        }
        if (!d.cloudSackPermObserved) out.push({ category: "TCP OPTIONS", severity: "INFO", text: "Selective ACK was not negotiated on cloud flows — loss recovery will be slow on lossy paths." });
        if (!d.cloudTimestampsObserved) out.push({ category: "TCP OPTIONS", severity: "INFO", text: "TCP Timestamps were not negotiated — RTT measurement and PAWS protection are degraded." });
    }

    // Cloud short-flow / reconnect-storm summary (now flow-duration aware).
    let shortFlows = 0;
    d.cloudFlows.forEach(s => {
        if (s.closedTs !== null && (s.closedTs - s.firstTs) < 30) shortFlows++;
    });
    if (shortFlows >= 3) out.push({ category: "CLOUD", severity: "WARNING", text: `${shortFlows} cloud flow(s) closed within 30 s of opening — looks like a reconnect loop, not normal long-poll rotation.` });

    if (d.tcpRetransToCloud > 0) out.push({ category: "CLOUD", severity: "WARNING", text: `${d.tcpRetransToCloud} TCP retransmission(s) to cloud flows — likely packet loss.` });
    if (d.cloudDupAckCount > 0) out.push({ category: "CLOUD", severity: "WARNING", text: `${d.cloudDupAckCount} run(s) of duplicate ACKs (≥3 dups) — receiver is missing packets.` });

    if (d.commandConnectorDests.size) {
        out.push({ category: "LOCAL", severity: "NEUTRAL", text: `TLS to local RFC1918 hosts (likely Verkada Command Connector): ${setToArray(d.commandConnectorDests).sort().join(", ")}.` });
    }

    if (d.rtspSeen) out.push({ category: "APP", severity: "INFO", text: "RTSP (TCP/554) traffic observed — non-standard for Verkada cameras." });
    if (d.stunSeen) out.push({ category: "APP", severity: "INFO", text: "STUN messages observed — live local viewing or peer-to-peer NAT discovery in progress." });
    if (d.plaintextHttpInternetCount > 0) out.push({ category: "SECURITY", severity: "WARNING", text: `${d.plaintextHttpInternetCount} plaintext HTTP request(s) to public IPs — cameras should not speak HTTP in the clear to the internet.` });

    if (d.rttSamplesMs.length) {
        const med = median(d.rttSamplesMs);
        const worst = Math.max(...d.rttSamplesMs);
        const jit = stdev(d.rttSamplesMs);
        out.push({ category: "RTT", severity: "NEUTRAL", text: `median ${med.toFixed(1)} ms, worst ${worst.toFixed(1)} ms, jitter σ ${jit.toFixed(1)} ms over ${d.rttSamplesMs.length} TCP handshake(s).` });
        if (med > 150) out.push({ category: "RTT", severity: "INFO", text: `Median RTT ${med.toFixed(0)} ms — handshakes may feel slow if the device should be near US-East.` });
        if (jit > med * 0.5 && d.rttSamplesMs.length >= 4) {
            out.push({ category: "RTT", severity: "WARNING", text: `RTT jitter ≈ ${(jit / med * 100).toFixed(0)}% of median — variable path, expect intermittent stalls.` });
        }
    }

    if (d.ntpSent) {
        if (d.ntpRcvd) out.push({ category: "TIME SYNC", severity: "PASS", text: `NTP request/response observed (servers: [${setToArray(d.ntpServers).sort().join(", ")}]).` });
        else out.push({ category: "TIME SYNC", severity: "CRITICAL", text: "NTP requests sent, no response — TLS cert validation will likely fail." });
    }

    if (d.local4100AsServer) out.push({ category: "LOCAL", severity: "INFO", text: "TCP/4100 (Verkada local control) traffic observed — device acting as server." });
    if (d.local4100AsClient) out.push({ category: "LOCAL", severity: "WARNING", text: "Device initiated outbound TCP to remote:4100 — unusual; cameras are normally the local-control server, not the client." });
    if (d.tls443) out.push({ category: "TLS", severity: "INFO", text: "TCP/443 traffic observed." });
    if (d.badCertDetected) out.push({ category: "SECURITY", severity: "CRITICAL", text: "TLS alert 42 (bad_certificate) — likely SSL inspection or untrusted CA in path." });
    if (d.tcpRstFromDev) out.push({ category: "TCP", severity: "WARNING", text: "RST originated from device (camera tore down the session)." });
    if (d.tcpRstFromNet) out.push({ category: "TCP", severity: "CRITICAL", text: "RST originated from network (upstream firewall/middlebox killed the session)." });

    if (shared.stpTopologyChanges > 0) out.push({ category: "L2 STP", severity: "WARNING", text: `${shared.stpTopologyChanges} STP topology change(s) observed during capture — link instability upstream.` });
    if (shared.ipv6RaCount > 0) out.push({ category: "IPv6", severity: "INFO", text: `${shared.ipv6RaCount} ICMPv6 Router Advertisement(s) observed.` });

    for (const w of setToArray(d.healthWarnings).sort()) {
        out.push({ category: "HEALTH", severity: "NEUTRAL", text: w });
    }

    // Wrong-VLAN diagnosis via LLDP-MED Network Policy.
    if (d.medPolicy && d.medPolicy.tagged && d.vlansSeen.size) {
        const expected = d.medPolicy.vlanId;
        if (!setToArray(d.vlansSeen).includes(expected)) {
            out.push({ category: "L2 VLAN", severity: "WARNING", text: `Switch's LLDP-MED policy says tagged VLAN ${expected}, but observed device traffic is on VLAN [${setToArray(d.vlansSeen).join(", ")}].` });
        }
    }

    return out;
}

function rcodeName(c: number): string {
    return ["NoError", "FormErr", "ServFail", "NXDomain", "NotImp", "Refused", "YXDomain", "YXRRSet", "NXRRSet", "NotAuth"][c] ?? `rcode${c}`;
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ============================================================================
// Plain-English diagnoses
// ============================================================================

function buildDiagnoses(d: DevState, cloudSuffixes: string[]): Diagnosis[] {
    const out: Diagnosis[] = [];
    const healthWarnings = setToArray(d.healthWarnings);
    const hasUpstreamPolicy = healthWarnings.some(w => w.startsWith("UPSTREAM POLICY"));
    const hasMtuIssue = healthWarnings.some(w => w.startsWith("MTU/PMTUD") || w.startsWith("ICMPv6: Packet Too Big"));
    const hasZeroWindow = healthWarnings.some(w => w.startsWith("FLOW CONTROL"));
    const hasIcmpv6Prohibited = healthWarnings.some(w => w.startsWith("ICMPv6: communication administratively prohibited"));

    if (d.eapFailure) {
        out.push({
            severity: "CRITICAL",
            text: "802.1X is enabled on the switchport and is rejecting the camera (EAP Failure). The camera cannot reach the LAN until port authentication succeeds — check the RADIUS configuration and the MAC/credentials registered for this device, or move the port to an unauthenticated VLAN.",
            packetRefs: d.eventPackets.get("eap_failure"),
        });
    }

    if (!d.matchedAsSrc) {
        out.push({
            severity: "WARNING",
            text: "This MAC was only ever seen as a destination of traffic from other hosts — we never observed it transmit. Either the device is not powered/connected, or the capture is one-directional from this device's perspective (e.g., SPAN mirrors only one direction).",
        });
    } else if (!d.dhcpAckSeen && !d.ipTrafficSeen) {
        out.push({
            severity: "CRITICAL",
            text: "The camera is not putting any IP traffic on the wire. It may be unpowered, the switchport may be down, or it is being blocked at L2 (802.1X, port security, MAC filtering).",
        });
    }

    if (d.dhcpNakSeen) {
        out.push({
            severity: "CRITICAL",
            text: "The DHCP server returned NAK to the camera — it refused to grant a lease. Usually the camera's REQUEST asked for an address outside the current scope (lease moved subnets, stale lease cached, or scope exhaustion).",
            packetRefs: d.eventPackets.get("dhcp_nak"),
        });
    }
    if (d.dhcpDeclineSeen) {
        out.push({
            severity: "CRITICAL",
            text: "The camera sent DHCP DECLINE on the offered address — typically because its ARP probe detected another host already using that IP. Look for a duplicate IP in the DHCP scope / static assignments.",
            packetRefs: d.eventPackets.get("dhcp_decline"),
        });
    }
    if (d.dhcpServerIds.size >= 2) {
        out.push({
            severity: "WARNING",
            text: `Multiple DHCP servers were heard answering on this segment (${setToArray(d.dhcpServerIds).sort().join(", ")}). Unless this is intentional redundancy, one of them is rogue — likely a misconfigured access point, virtualization host, or appliance.`,
        });
    }
    if (d.dhcpDiscoverCount >= 2 && !d.dhcpAckSeen) {
        out.push({
            severity: "CRITICAL",
            text: `The camera sent ${d.dhcpDiscoverCount} DHCP DISCOVERs and never received an ACK. The DHCP server is unreachable or refusing this device — check the DHCP scope, the relay/helper address on the gateway, and any MAC-based filters.`,
            packetRefs: d.eventPackets.get("dhcp_discover"),
        });
    } else if (d.dhcpDiscoverCount >= 2) {
        out.push({
            severity: "WARNING",
            text: `The camera repeated DHCP DISCOVER ${d.dhcpDiscoverCount} times during the capture, which usually means it lost its lease or rebooted mid-capture (possible reboot loop).`,
            packetRefs: d.eventPackets.get("dhcp_discover"),
        });
    }

    if (d.dhcpGateway && d.gwArpReq && !d.gwArpRes) {
        out.push({
            severity: "WARNING",
            text: `The camera ARPed for its default gateway (${d.dhcpGateway}) but never saw a reply in this capture. The reply may have been missed because the capture is one-directional (SPAN), the gateway IP from DHCP may be wrong, or the gateway is offline.`,
            packetRefs: d.eventPackets.get("arp_gw_req"),
        });
    }

    const conflicts: string[] = [];
    d.ipClaims.forEach((macs, ip) => { if (macs.size > 1) conflicts.push(`${ip} claimed by [${setToArray(macs).join(", ")}]`); });
    if (conflicts.length) {
        out.push({
            severity: "CRITICAL",
            text: `IP address conflict observed via ARP: ${conflicts.join("; ")}. Two hosts on the same segment are using the same IP — one needs to be reassigned or evicted before the camera can stay online.`,
        });
    }

    if (d.dnsHijackWarn) {
        const inner = d.dnsHijackWarn.replace(/^\(|\)$/g, "");
        out.push({
            severity: "CRITICAL",
            text: `DNS is being hijacked — ${inner}. A Verkada hostname is resolving to a non-public IP, so the camera will never reach the real Verkada cloud. Check upstream DNS filtering, "safe-search" appliances, or captive-portal interception.`,
        });
    } else if (d.dnsUdp53QueriesCount > 0 && d.dnsSuccessCount === 0) {
        const servfail = d.dnsRcodeCounts.get(2) ?? 0;
        const nxdomain = d.dnsRcodeCounts.get(3) ?? 0;
        if (servfail > 0) {
            out.push({
                severity: "CRITICAL",
                text: `The configured DNS resolver returned SERVFAIL ${servfail} time(s). Either the upstream recursive resolver is broken, or DNSSEC validation is failing — switch DNS server or fix the resolver.`,
                packetRefs: d.eventPackets.get("dns_error"),
            });
        } else if (nxdomain > 0) {
            out.push({
                severity: "CRITICAL",
                text: `${nxdomain} DNS lookup(s) returned NXDOMAIN. The names exist (Verkada cameras query well-known hostnames) but the resolver is being told they don't — usually a DNS-blocking firewall, "safe-browsing" appliance, or a stale/misconfigured DNS zone.`,
                packetRefs: d.eventPackets.get("dns_error"),
            });
        } else {
            out.push({
                severity: "CRITICAL",
                text: "The camera is sending DNS queries over UDP/53 but never receiving a valid answer. UDP/53 is being blocked, the configured DNS server is unreachable, or every query is timing out.",
                packetRefs: d.eventPackets.get("dns_error"),
            });
        }
    }

    // Per-FQDN criticality (only fires for resolved-but-unreachable cloud destinations).
    const unreachable: { rule: FqdnRule; host: string }[] = [];
    d.dnsVerkadaResolved.forEach(host => {
        const rule = classifyVerkadaFqdn(host);
        if (!rule) return;
        const ips = d.dnsResolvedByHost.get(host);
        if (!ips) return;
        // Did the device ever reach any of those IPs (SYN-ACK on TCP/443 or NTP response)?
        let reached = false;
        ips.forEach(ip => {
            if (rule.function === "NTP / time sync") {
                if (d.ntpRcvd && d.ntpServers.has(ip)) reached = true;
            } else {
                if (d.cloudSynackDests.has(`${ip}:443`)) reached = true;
            }
        });
        if (!reached) unreachable.push({ rule, host });
    });
    // Also include hostnames the camera queried but that never resolved at all.
    d.dnsVerkadaUnresolved.forEach(host => {
        const rule = classifyVerkadaFqdn(host);
        if (rule) unreachable.push({ rule, host });
    });
    // Group by criticality.
    const essentialDown = unreachable.filter(u => u.rule.criticality === "essential");
    const operationalDown = unreachable.filter(u => u.rule.criticality === "operational");
    const auxiliaryDown = unreachable.filter(u => u.rule.criticality === "auxiliary");
    if (essentialDown.length) {
        const lines = essentialDown.map(u => `${u.host} (${u.rule.function}: ${u.rule.failureImpact})`);
        out.push({
            severity: "CRITICAL",
            text: `Essential Verkada FQDN(s) unreachable: ${lines.join("; ")}.`,
        });
    }
    if (operationalDown.length) {
        const lines = operationalDown.map(u => `${u.host} (${u.rule.function})`);
        out.push({
            severity: "WARNING",
            text: `Operational Verkada FQDN(s) unreachable: ${lines.join("; ")}. Local viewing or peer features may be degraded.`,
        });
    }
    if (auxiliaryDown.length) {
        const lines = auxiliaryDown.map(u => `${u.host}`);
        out.push({
            severity: "WARNING",
            text: `Auxiliary Verkada FQDN(s) unreachable: ${lines.join(", ")}. Camera is operational but OTA / firmware updates will fail.`,
        });
    }

    const sniMismatches: string[] = [];
    d.sniToDestIps.forEach((destIps, sni) => {
        const resolved = d.dnsResolvedByHost.get(sni);
        if (!resolved) return;
        const bad: string[] = [];
        destIps.forEach(ip => { if (!resolved.has(ip)) bad.push(ip); });
        if (bad.length) sniMismatches.push(`${sni} → ${bad.join(", ")} (DNS said ${setToArray(resolved).join(", ")})`);
    });
    if (sniMismatches.length) {
        out.push({
            severity: "WARNING",
            text: `The camera's TLS ClientHello SNI does not match the IPs returned by DNS during this capture: ${sniMismatches.join("; ")}. This is usually a transparent proxy intercepting traffic by IP — or a stale DNS cache being used after the resolver answered something different.`,
        });
    }

    const unansweredCloud: string[] = [];
    d.cloudSynDests.forEach(k => { if (!d.cloudSynackDests.has(k)) unansweredCloud.push(k); });
    if (unansweredCloud.length) {
        out.push({
            severity: "CRITICAL",
            text: `The camera is sending TCP SYNs to the Verkada cloud (${unansweredCloud.sort().join(", ")}) but no SYN-ACKs are coming back. An upstream firewall is dropping outbound traffic to those endpoints — verify Verkada's required IP/port allowlist on the perimeter firewall.`,
            packetRefs: d.eventPackets.get("cloud_syn"),
        });
    } else if (d.cloudSynDests.size === 0 && d.dnsVerkadaQueries.size > 0 && d.sniHostnames.size === 0) {
        out.push({
            severity: "WARNING",
            text: "The camera resolved Verkada cloud hostnames but did not attempt any TCP connection during the capture. It may not have reached the connection phase yet, or outbound traffic is being filtered before it ever leaves the device.",
        });
    }

    // Reconnect storm (flow-duration aware).
    let shortFlows = 0;
    const shortDetails: string[] = [];
    d.cloudFlows.forEach((s, key) => {
        if (s.closedTs !== null && (s.closedTs - s.firstTs) < 30) {
            shortFlows++;
            if (shortDetails.length < 4) shortDetails.push(`${key.split(">")[1]} closed after ${((s.closedTs - s.firstTs)).toFixed(1)}s`);
        }
    });
    if (shortFlows >= 3) {
        out.push({
            severity: "WARNING",
            text: `The camera opened ${shortFlows} cloud TCP connections that closed within 30 s each (${shortDetails.join("; ")}). Something — TLS handshake, idle timeout, application keepalive — is failing soon after connect, prompting a reconnect.`,
        });
    }

    if (d.tcpRetransToCloud >= 5) {
        out.push({
            severity: "WARNING",
            text: `${d.tcpRetransToCloud} TCP retransmissions on cloud flows — there is real packet loss on the path. Look for congestion, duplex mismatch, faulty cable/transceiver, or wireless interference between the camera and the gateway.`,
        });
    }
    if (d.cloudDupAckCount >= 3) {
        out.push({
            severity: "WARNING",
            text: `${d.cloudDupAckCount} run(s) of ≥3 duplicate ACKs on cloud flows — the camera (or the cloud side) is losing in-flight packets, which forces fast-retransmit cycles.`,
        });
    }

    // TCP option diagnoses (only if any cloud SYN-ACK was observed).
    if (d.cloudSynAckCount > 0) {
        if (d.cloudMinMss !== null && d.cloudMinMss < 1460) {
            out.push({
                severity: "WARNING",
                text: `TCP MSS on cloud SYN/SYN-ACK is ${d.cloudMinMss} (standard Ethernet is 1460). Some device on the path — usually a VPN tunnel, IPsec gateway, or MSS-clamping firewall — is reducing the MSS. Real throughput will be capped and PMTU issues may surface.`,
            });
        }
        if (d.cloudWscaleObserved && d.cloudMaxWscale === 0) {
            out.push({
                severity: "WARNING",
                text: "TCP window scale negotiated as 0 on cloud flows — the receive window is capped at 64 KB regardless of RTT. On any path with non-trivial latency, throughput will be poor. A middlebox (commonly old firewalls) is likely stripping the window-scale option.",
            });
        }
        if (!d.cloudSackPermObserved && d.cloudSynAckCount >= 2) {
            out.push({
                severity: "WARNING",
                text: "Selective ACK (SACK) was not negotiated on cloud flows — a middlebox is stripping TCP option 4. On a lossy path the camera will retransmit far more than necessary.",
            });
        }
    }

    if (d.ntpSent && !d.ntpRcvd) {
        out.push({
            severity: "CRITICAL",
            text: "The camera is sending NTP requests (UDP/123) but never receives a reply. Until time sync works, TLS certificate validation will fail and the camera will not be able to connect to the cloud — open UDP/123 outbound or point the camera at a reachable NTP server.",
            packetRefs: d.eventPackets.get("ntp_request"),
        });
    }

    if (d.badCertDetected) {
        out.push({
            severity: "CRITICAL",
            text: "TLS handshake failed with bad_certificate (alert 42). This almost always means an SSL/TLS inspection middlebox is between the camera and the cloud and is presenting its own certificate — cameras pin Verkada's CA and will not trust it. Exempt Verkada destinations from inspection on the firewall.",
            packetRefs: d.eventPackets.get("tls_bad_cert"),
        });
    }

    // ALPN check — if the camera reached cloud TLS but never offered h2, flag.
    if (d.cloudTlsApplicationDataSeen && d.tlsAlpns.size > 0 && !d.tlsAlpns.has("h2")) {
        out.push({
            severity: "WARNING",
            text: `The camera's TLS ClientHello does not include ALPN "h2" (HTTP/2) — ALPN seen was [${setToArray(d.tlsAlpns).join(", ")}]. Verkada cloud expects h2; some middlebox may be rewriting ALPN.`,
        });
    }

    if (d.tcpRstFromNet) {
        out.push({
            severity: "CRITICAL",
            text: "TCP RST packets are arriving from the network and tearing down the camera's sessions. A firewall, IPS, or other stateful middlebox is killing the connection — check session timeout values and any intrusion-prevention rules that might be matching this traffic.",
            packetRefs: d.eventPackets.get("tcp_rst_from_net"),
        });
    } else if (d.tcpRstFromDev) {
        out.push({
            severity: "WARNING",
            text: "The camera itself is resetting some of its TCP sessions, which usually indicates it received an unexpected response, hit an application-level error, or aborted a stalled connection.",
            packetRefs: d.eventPackets.get("tcp_rst_from_dev"),
        });
    }

    if (hasUpstreamPolicy || hasIcmpv6Prohibited) {
        out.push({
            severity: "CRITICAL",
            text: "A firewall on the path returned ICMP \"administratively prohibited,\" explicitly blocking the camera's outbound traffic. Compare the camera's destination IPs/ports against the firewall's allow-list.",
            packetRefs: d.eventPackets.get("icmp_prohibited"),
        });
    }
    if (hasMtuIssue || d.ipv4FragmentCount > 0) {
        out.push({
            severity: "WARNING",
            text: "Path MTU mismatch — either ICMP Fragmentation Needed / Packet Too Big was returned, or IPv4 fragments were observed. If PMTU discovery is being blackholed (ICMP dropped upstream), large frames will silently fail.",
            packetRefs: d.eventPackets.get("icmp_frag_needed"),
        });
    }
    if (hasZeroWindow) {
        out.push({
            severity: "WARNING",
            text: "A TCP Zero Window was advertised on a Verkada session — the remote receiver's buffer filled up, which usually means one side cannot keep up with the data rate of the other.",
        });
    }

    if (d.rttSamplesMs.length >= 4) {
        const med = median(d.rttSamplesMs);
        const jit = stdev(d.rttSamplesMs);
        if (jit > med * 0.5 && jit > 10) {
            out.push({
                severity: "WARNING",
                text: `RTT to the cloud is unstable — median ${med.toFixed(0)} ms with σ=${jit.toFixed(0)} ms of jitter. Streaming will stutter. Look for shared/contended uplinks, wireless backhaul, or a VPN tunnel that's flapping.`,
            });
        }
    }

    if (d.pseMedPoe && d.pdMedPoe && d.pdMedPoe.powerW > d.pseMedPoe.powerW) {
        out.push({
            severity: "CRITICAL",
            text: `PoE budget mismatch: the camera requests ${d.pdMedPoe.powerW.toFixed(1)} W via LLDP-MED but the switch is only allocating ${d.pseMedPoe.powerW.toFixed(1)} W. The camera will brownout (random reboots, IR off, motors stalled) until the port's PoE class allocation is raised.`,
        });
    } else if (d.pseMedPoe && d.pseMedPoe.powerPriority === "Low") {
        out.push({
            severity: "WARNING",
            text: `The switch is reporting PoE priority "Low" for this port — if the switch's overall PoE budget is exhausted, this port is the first to be shed. Move to a port with Critical/High priority for production cameras.`,
        });
    }

    if (d.local4100AsClient) {
        out.push({
            severity: "WARNING",
            text: "The camera initiated outbound TCP to a remote on port 4100. TCP/4100 is the local-control port the camera serves to NVR-like clients — the camera shouldn't be the originator. Some other host on the LAN is asking the camera to act as a client, or a misconfiguration is in place.",
        });
    }

    if (d.medPolicy && d.medPolicy.tagged && d.vlansSeen.size && !setToArray(d.vlansSeen).includes(d.medPolicy.vlanId)) {
        out.push({
            severity: "WARNING",
            text: `Switch's LLDP-MED policy advertises tagged VLAN ${d.medPolicy.vlanId}, but the camera's traffic is on VLAN(s) [${setToArray(d.vlansSeen).join(", ")}]. The camera is not honoring the switch's policy — check the camera's VLAN config and the port's allowed VLAN list.`,
        });
    }

    if (d.plaintextHttpInternetCount > 0) {
        out.push({
            severity: "WARNING",
            text: `The camera made ${d.plaintextHttpInternetCount} plaintext HTTP request(s) to public IPs. Verkada cameras shouldn't be speaking HTTP in the clear to the internet — investigate whether traffic is being downgraded, or whether the camera is misconfigured.`,
        });
    }

    if (d.dohSeen || d.dotSeen) {
        out.push({
            severity: "WARNING",
            text: "DNS-over-HTTPS or DNS-over-TLS traffic observed from the camera — its DNS resolution path has been overridden. This isn't necessarily broken, but it bypasses your network's DNS controls.",
        });
    }

    return out;
}
