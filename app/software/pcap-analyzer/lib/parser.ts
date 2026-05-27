/**
 * Browser-native pcap / pcapng parser and packet decoders for the
 * protocols the Verkada audit cares about.
 *
 * Ported from the Python (scapy) implementation in
 * Verkada_PCAP_Parser/main.py. Keeps decoding minimal but
 * faithful — only the fields the analyzer reads.
 */

const PCAP_MAGIC_BE = 0xa1b2c3d4;
const PCAP_MAGIC_LE = 0xd4c3b2a1;
const PCAP_NS_MAGIC_BE = 0xa1b23c4d;
const PCAP_NS_MAGIC_LE = 0x4d3cb2a1;
const PCAPNG_BLOCK_SHB = 0x0a0d0d0a;
const PCAPNG_BLOCK_IDB = 0x00000001;
const PCAPNG_BLOCK_PB = 0x00000002;
const PCAPNG_BLOCK_SPB = 0x00000003;
const PCAPNG_BLOCK_EPB = 0x00000006;
const PCAPNG_BOM = 0x1a2b3c4d;
const LINKTYPE_ETHERNET = 1;

export interface RawPacket {
    data: Uint8Array;
    ts: number;     // seconds since epoch (fractional)
    origLen: number; // original on-wire length (data.length is the capture-truncated length)
}

export async function loadCapture(file: File): Promise<RawPacket[]> {
    const buf = new Uint8Array(await file.arrayBuffer());
    return await parseCaptureBytes(buf);
}

export async function parseCaptureBytes(input: Uint8Array): Promise<RawPacket[]> {
    let buf = input;
    if (buf.length >= 4 && buf[0] === 0x28 && buf[1] === 0xb5 && buf[2] === 0x2f && buf[3] === 0xfd) {
        const { decompress } = await import("fzstd");
        buf = decompress(buf);
    }
    if (buf.length < 4) throw new Error("File too short to be a packet capture.");
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magicBE = dv.getUint32(0, false);
    if (magicBE === PCAPNG_BLOCK_SHB) return parsePcapng(buf);
    return parsePcap(buf, dv);
}

function parsePcap(buf: Uint8Array, dv: DataView): RawPacket[] {
    const magic = dv.getUint32(0, false);
    let le: boolean;
    let nanos = false;
    switch (magic) {
        case PCAP_MAGIC_BE: le = false; break;
        case PCAP_MAGIC_LE: le = true; break;
        case PCAP_NS_MAGIC_BE: le = false; nanos = true; break;
        case PCAP_NS_MAGIC_LE: le = true; nanos = true; break;
        default:
            throw new Error(`Unrecognized pcap magic 0x${magic.toString(16).padStart(8, "0")}.`);
    }
    const linktype = dv.getUint32(20, le);
    if (linktype !== LINKTYPE_ETHERNET) {
        throw new Error(linktypeError(linktype));
    }
    const out: RawPacket[] = [];
    let off = 24;
    while (off + 16 <= buf.length) {
        const sec = dv.getUint32(off, le);
        const sub = dv.getUint32(off + 4, le);
        const capLen = dv.getUint32(off + 8, le);
        const origLen = dv.getUint32(off + 12, le);
        off += 16;
        if (capLen > buf.length - off) break;
        out.push({
            data: buf.subarray(off, off + capLen),
            ts: sec + (nanos ? sub / 1e9 : sub / 1e6),
            origLen,
        });
        off += capLen;
    }
    return out;
}

function linktypeError(linktype: number): string {
    if (linktype === 113) {
        return "This capture uses Linux SLL (linktype 113) — it was taken with `tcpdump -i any`. Re-run tcpdump against a specific interface (e.g., `-i eth0`) so the capture is Ethernet-framed.";
    }
    if (linktype === 127 || linktype === 105) {
        return `This looks like a wireless capture (linktype ${linktype}). The analyzer only supports Ethernet (linktype 1) — capture from the wired uplink or a switch SPAN port instead.`;
    }
    return `Unsupported link-layer type ${linktype}; only Ethernet (1) is supported.`;
}

function parsePcapng(buf: Uint8Array): RawPacket[] {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const out: RawPacket[] = [];
    let off = 0;
    let le = true;
    // Per-interface tsresol; default microseconds (10^-6).
    const tsResolPow10: number[] = [];
    const tsResolPow2: number[] = [];

    while (off + 12 <= buf.length) {
        const blockType = dv.getUint32(off, le);
        if (blockType === PCAPNG_BLOCK_SHB) {
            // Section Header Block — re-detect endianness from byte-order magic.
            const bomLE = dv.getUint32(off + 8, true);
            le = (bomLE === PCAPNG_BOM);
            const blockLen = dv.getUint32(off + 4, le);
            if (blockLen < 12 || off + blockLen > buf.length) break;
            tsResolPow10.length = 0;
            tsResolPow2.length = 0;
            off += blockLen;
            continue;
        }
        const blockLen = dv.getUint32(off + 4, le);
        if (blockLen < 12 || off + blockLen > buf.length) break;

        if (blockType === PCAPNG_BLOCK_IDB) {
            // Body: linktype (2), reserved (2), snaplen (4), then options.
            let pow10 = 6;
            let pow2 = -1;
            let oo = off + 16;
            const blockEnd = off + blockLen - 4;
            while (oo + 4 <= blockEnd) {
                const code = dv.getUint16(oo, le);
                const optLen = dv.getUint16(oo + 2, le);
                if (code === 0) break;
                if (code === 9 && optLen >= 1) {
                    const v = buf[oo + 4];
                    if ((v & 0x80) === 0) { pow10 = v; pow2 = -1; }
                    else { pow2 = v & 0x7f; pow10 = -1; }
                }
                oo += 4 + ((optLen + 3) & ~3);
            }
            tsResolPow10.push(pow10);
            tsResolPow2.push(pow2);
        } else if (blockType === PCAPNG_BLOCK_EPB) {
            const ifaceId = dv.getUint32(off + 8, le);
            const tsHigh = dv.getUint32(off + 12, le);
            const tsLow = dv.getUint32(off + 16, le);
            const capLen = dv.getUint32(off + 20, le);
            const origLen = dv.getUint32(off + 24, le);
            const dataOff = off + 28;
            if (capLen <= buf.length - dataOff) {
                const ts64 = tsHigh * 4294967296 + tsLow;
                const p2 = tsResolPow2[ifaceId] ?? -1;
                const p10 = tsResolPow10[ifaceId] ?? 6;
                const ts = p2 >= 0 ? ts64 / Math.pow(2, p2) : ts64 / Math.pow(10, p10);
                out.push({ data: buf.subarray(dataOff, dataOff + capLen), ts, origLen });
            }
        } else if (blockType === PCAPNG_BLOCK_PB) {
            // Obsolete Packet Block.
            const ifaceId = dv.getUint16(off + 8, le);
            const tsHigh = dv.getUint32(off + 12, le);
            const tsLow = dv.getUint32(off + 16, le);
            const capLen = dv.getUint32(off + 20, le);
            const origLen = dv.getUint32(off + 24, le);
            const dataOff = off + 28;
            if (capLen <= buf.length - dataOff) {
                const ts64 = tsHigh * 4294967296 + tsLow;
                const p2 = tsResolPow2[ifaceId] ?? -1;
                const p10 = tsResolPow10[ifaceId] ?? 6;
                const ts = p2 >= 0 ? ts64 / Math.pow(2, p2) : ts64 / Math.pow(10, p10);
                out.push({ data: buf.subarray(dataOff, dataOff + capLen), ts, origLen });
            }
        } else if (blockType === PCAPNG_BLOCK_SPB) {
            const origLen = dv.getUint32(off + 8, le);
            const dataOff = off + 12;
            // SPB: original length first; capLen = min(snaplen, origLen) — we don't have snaplen, treat as origLen.
            const capLen = Math.min(origLen, buf.length - dataOff);
            if (capLen >= 0) {
                out.push({ data: buf.subarray(dataOff, dataOff + capLen), ts: 0, origLen });
            }
        }
        off += blockLen;
    }
    return out;
}

// ============================================================================
// Protocol decoders
// ============================================================================

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

function macStr(b: Uint8Array, off: number): string {
    const h = (n: number) => n.toString(16).padStart(2, "0");
    return `${h(b[off])}:${h(b[off + 1])}:${h(b[off + 2])}:${h(b[off + 3])}:${h(b[off + 4])}:${h(b[off + 5])}`;
}

function ipv4Str(b: Uint8Array, off: number): string {
    return `${b[off]}.${b[off + 1]}.${b[off + 2]}.${b[off + 3]}`;
}

function dvOf(b: Uint8Array): DataView {
    return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

export interface EtherFrame {
    dst: string;
    src: string;
    type: number;     // ethertype (post-VLAN unwrap)
    vlan?: number;
    payloadOff: number;
}

export function parseEther(data: Uint8Array): EtherFrame | null {
    if (data.length < 14) return null;
    const dv = dvOf(data);
    const dst = macStr(data, 0);
    const src = macStr(data, 6);
    let type = dv.getUint16(12, false);
    let off = 14;
    let vlan: number | undefined;
    // Unwrap stacked VLAN tags (QinQ). Outer 0x88a8 or 0x9100, inner 0x8100.
    while (type === 0x8100 || type === 0x88a8 || type === 0x9100) {
        if (data.length < off + 4) return null;
        const innerVlan = dv.getUint16(off, false) & 0x0fff;
        if (vlan === undefined) vlan = innerVlan;
        type = dv.getUint16(off + 2, false);
        off += 4;
    }
    return { dst, src, type, vlan, payloadOff: off };
}

export interface Ipv4 {
    src: string;
    dst: string;
    proto: number;
    payloadOff: number;
    payloadLen: number;
}

export function parseIpv4(data: Uint8Array, off: number): Ipv4 | null {
    if (data.length < off + 20) return null;
    if ((data[off] >> 4) !== 4) return null;
    const ihl = (data[off] & 0x0f) * 4;
    if (ihl < 20 || data.length < off + ihl) return null;
    const totalLen = (data[off + 2] << 8) | data[off + 3];
    const proto = data[off + 9];
    const src = ipv4Str(data, off + 12);
    const dst = ipv4Str(data, off + 16);
    const payloadOff = off + ihl;
    const payloadLen = Math.max(0, Math.min(totalLen, data.length - off) - ihl);
    return { src, dst, proto, payloadOff, payloadLen };
}

export interface ArpFrame {
    op: number;
    spa: string;
    tpa: string;
    sha: string;
    tha: string;
}

export function parseArp(data: Uint8Array, off: number): ArpFrame | null {
    if (data.length < off + 28) return null;
    const op = (data[off + 6] << 8) | data[off + 7];
    const sha = macStr(data, off + 8);
    const spa = ipv4Str(data, off + 14);
    const tha = macStr(data, off + 18);
    const tpa = ipv4Str(data, off + 24);
    return { op, spa, tpa, sha, tha };
}

export interface IcmpHdr {
    type: number;
    code: number;
}

export function parseIcmp(data: Uint8Array, off: number): IcmpHdr | null {
    if (data.length < off + 2) return null;
    return { type: data[off], code: data[off + 1] };
}

export const TCP_FIN = 0x01;
export const TCP_SYN = 0x02;
export const TCP_RST = 0x04;
export const TCP_ACK = 0x10;

export interface TcpHdr {
    sport: number;
    dport: number;
    seq: number;
    ack: number;
    flags: number;
    /** bits 6 and 7 of the upper flags byte (CWR/ECE) */
    ecnNegotiate: boolean;
    window: number;
    payloadOff: number;
    payloadLen: number;
    /** TCP options parsed from the header (present even on non-SYN segments, but MSS / wscale / SACK_PERM only appear on SYN/SYN-ACK). */
    options: TcpOptions;
}

export interface TcpOptions {
    mss?: number;
    wscale?: number;
    sackPerm?: boolean;
    timestamps?: boolean;
    sackBlocks?: number;
}

function parseTcpOptions(data: Uint8Array, off: number, len: number): TcpOptions {
    const opts: TcpOptions = {};
    const end = off + len;
    let p = off;
    while (p < end) {
        const kind = data[p];
        if (kind === 0) break;          // EOL
        if (kind === 1) { p++; continue; } // NOP
        if (p + 1 >= end) break;
        const optLen = data[p + 1];
        if (optLen < 2 || p + optLen > end) break;
        if (kind === 2 && optLen === 4) {
            opts.mss = (data[p + 2] << 8) | data[p + 3];
        } else if (kind === 3 && optLen === 3) {
            opts.wscale = data[p + 2];
        } else if (kind === 4 && optLen === 2) {
            opts.sackPerm = true;
        } else if (kind === 5) {
            opts.sackBlocks = (opts.sackBlocks ?? 0) + Math.floor((optLen - 2) / 8);
        } else if (kind === 8 && optLen === 10) {
            opts.timestamps = true;
        }
        p += optLen;
    }
    return opts;
}

export function parseTcp(data: Uint8Array, off: number, ipPayloadLen: number): TcpHdr | null {
    if (data.length < off + 20) return null;
    const dv = dvOf(data);
    const sport = dv.getUint16(off, false);
    const dport = dv.getUint16(off + 2, false);
    const seq = dv.getUint32(off + 4, false);
    const ack = dv.getUint32(off + 8, false);
    const dataOff = ((data[off + 12] >> 4) & 0x0f) * 4;
    if (dataOff < 20 || data.length < off + dataOff) return null;
    // Upper 4 reserved bits + 2 ECN flag bits (CWR=0x80 of byte 13 of new layout
    // is actually byte 13 bit 7; on classic layout we read bits CWR/ECE from
    // the flags byte at off+13).
    const flagsByte = data[off + 13];
    const flags = flagsByte;
    const ecnNegotiate = (flagsByte & 0xc0) !== 0; // CWR or ECE present
    const window = dv.getUint16(off + 14, false);
    const payloadOff = off + dataOff;
    const payloadLen = Math.max(0, Math.min(ipPayloadLen - dataOff, data.length - payloadOff));
    const options = dataOff > 20 ? parseTcpOptions(data, off + 20, dataOff - 20) : {};
    return { sport, dport, seq, ack, flags, ecnNegotiate, window, payloadOff, payloadLen, options };
}

export interface UdpHdr {
    sport: number;
    dport: number;
    payloadOff: number;
    payloadLen: number;
}

export function parseUdp(data: Uint8Array, off: number): UdpHdr | null {
    if (data.length < off + 8) return null;
    const dv = dvOf(data);
    const sport = dv.getUint16(off, false);
    const dport = dv.getUint16(off + 2, false);
    const ulen = dv.getUint16(off + 4, false);
    const payloadOff = off + 8;
    const payloadLen = Math.max(0, Math.min(ulen, data.length - off) - 8);
    return { sport, dport, payloadOff, payloadLen };
}

export interface DhcpInfo {
    /** DHCP message type (option 53): 1=DISCOVER, 2=OFFER, 3=REQUEST, 4=DECLINE, 5=ACK, 6=NAK, 7=RELEASE, 8=INFORM. */
    messageType?: number;
    yiaddr?: string;
    router?: string;
    dns?: string[];
    /** option 54 (DHCP Server Identifier). */
    serverId?: string;
    /** option 51 (Lease Time) in seconds. */
    leaseTime?: number;
    /** option 60 (Vendor Class Identifier). */
    vendorClass?: string;
    /** option 12 (Host Name). */
    hostName?: string;
    /** option 1 (Subnet Mask) as prefix length (0-32). */
    subnetMaskPrefix?: number;
    /** option 82 presence (Relay Agent Info — indicates DHCP snooping). */
    relayAgentInfoPresent?: boolean;
    /** BOOTP transaction ID for response-matching. */
    xid?: number;
    /** BOOTP giaddr — non-zero indicates DHCP relay was used. */
    giaddr?: string;
}

export function parseDhcp(data: Uint8Array, off: number, len: number): DhcpInfo | null {
    if (len < 240) return null;
    const yiaddr = ipv4Str(data, off + 16);
    const giaddr = ipv4Str(data, off + 24);
    const dv = dvOf(data);
    const xid = dv.getUint32(off + 4, false);
    // Magic cookie 99.130.83.99 at offset 236.
    if (data[off + 236] !== 99 || data[off + 237] !== 130 ||
        data[off + 238] !== 83 || data[off + 239] !== 99) {
        return { yiaddr, giaddr: giaddr === "0.0.0.0" ? undefined : giaddr, xid };
    }
    const info: DhcpInfo = { yiaddr, xid };
    if (giaddr !== "0.0.0.0") info.giaddr = giaddr;
    let p = off + 240;
    const end = off + len;
    while (p < end) {
        const code = data[p++];
        if (code === 0) continue;
        if (code === 0xff) break;
        if (p >= end) break;
        const optLen = data[p++];
        if (p + optLen > end) break;
        if (code === 53 && optLen >= 1) {
            info.messageType = data[p];
        } else if (code === 1 && optLen >= 4) {
            const mask = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
            // Count leading 1 bits.
            let prefix = 0;
            let m = mask >>> 0;
            while (m & 0x80000000) { prefix++; m = (m << 1) >>> 0; }
            info.subnetMaskPrefix = prefix;
        } else if (code === 3 && optLen >= 4) {
            info.router = ipv4Str(data, p);
        } else if (code === 6) {
            const dns: string[] = [];
            for (let q = 0; q + 4 <= optLen; q += 4) dns.push(ipv4Str(data, p + q));
            info.dns = dns;
        } else if (code === 54 && optLen >= 4) {
            info.serverId = ipv4Str(data, p);
        } else if (code === 51 && optLen >= 4) {
            info.leaseTime = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
        } else if (code === 60 && optLen >= 1) {
            info.vendorClass = TEXT_DECODER.decode(data.subarray(p, p + optLen));
        } else if (code === 12 && optLen >= 1) {
            info.hostName = TEXT_DECODER.decode(data.subarray(p, p + optLen));
        } else if (code === 82) {
            info.relayAgentInfoPresent = true;
        }
        p += optLen;
    }
    return info;
}

export interface DnsAnswer {
    name: string;
    type: number;
    ttl: number;
    rdata?: string;
}

export interface DnsInfo {
    qr: number;
    rcode: number;
    ancount: number;
    qname: string;
    /** transaction ID (for matching queries to responses). */
    txid: number;
    answers: DnsAnswer[];
}

function readDnsName(data: Uint8Array, off: number, base: number, depth = 0): { name: string; next: number } {
    if (depth > 10) return { name: "", next: off };
    const parts: string[] = [];
    let p = off;
    let jumped = false;
    let next = off;
    while (p < data.length) {
        const l = data[p];
        if (l === 0) { p++; break; }
        if ((l & 0xc0) === 0xc0) {
            if (p + 1 >= data.length) break;
            const ptr = ((l & 0x3f) << 8) | data[p + 1];
            if (!jumped) next = p + 2;
            const sub = readDnsName(data, base + ptr, base, depth + 1);
            if (sub.name) parts.push(sub.name);
            jumped = true;
            return { name: parts.join("."), next };
        }
        if (p + 1 + l > data.length) break;
        parts.push(TEXT_DECODER.decode(data.subarray(p + 1, p + 1 + l)));
        p += 1 + l;
    }
    if (!jumped) next = p;
    return { name: parts.join("."), next };
}

export function parseDns(data: Uint8Array, off: number, len: number): DnsInfo | null {
    if (len < 12) return null;
    const dv = dvOf(data);
    const txid = dv.getUint16(off, false);
    const flags = dv.getUint16(off + 2, false);
    const qr = (flags >> 15) & 1;
    const rcode = flags & 0x000f;
    const qdcount = dv.getUint16(off + 4, false);
    const ancount = dv.getUint16(off + 6, false);
    let p = off + 12;
    let qname = "";
    for (let i = 0; i < qdcount; i++) {
        const r = readDnsName(data, p, off);
        if (i === 0) qname = r.name;
        p = r.next + 4; // QTYPE + QCLASS
        if (p > data.length) return { qr, rcode, ancount, qname, txid, answers: [] };
    }
    const answers: DnsAnswer[] = [];
    for (let i = 0; i < ancount; i++) {
        const r = readDnsName(data, p, off);
        p = r.next;
        if (p + 10 > data.length) break;
        const type = dv.getUint16(p, false);
        const ttl = dv.getUint32(p + 4, false);
        const rdlen = dv.getUint16(p + 8, false);
        p += 10;
        if (p + rdlen > data.length) break;
        let rdata: string | undefined;
        if (type === 1 && rdlen === 4) {
            rdata = ipv4Str(data, p);
        } else if (type === 28 && rdlen === 16) {
            // AAAA — produce a canonical-ish IPv6 string.
            const parts: string[] = [];
            for (let j = 0; j < 8; j++) parts.push(((data[p + j * 2] << 8) | data[p + j * 2 + 1]).toString(16));
            rdata = parts.join(":");
        } else if (type === 5) {
            rdata = readDnsName(data, p, off).name;
        }
        answers.push({ name: r.name, type, ttl, rdata });
        p += rdlen;
    }
    return { qr, rcode, ancount, qname, txid, answers };
}

export interface LldpMedPoE {
    /** "PSE" (switch / power source) or "PD" (endpoint / camera). */
    powerType: "PSE" | "PD" | "Unknown";
    /** "Primary" / "Backup" / "Reserved" — usually "Primary" from the switch. */
    powerSource: string;
    /** "Critical" / "High" / "Low" / "Unknown". */
    powerPriority: string;
    /** Power value in watts (0.1 W resolution on the wire). */
    powerW: number;
}

export interface LldpMedNetworkPolicy {
    /** App type: 1=voice, 2=voice-signaling, 3=guest, 4=guest-signaling, 5=softphone, 6=video-conf, 7=streaming-video, 8=video-signaling */
    appType: number;
    tagged: boolean;
    vlanId: number;
    l2Priority: number;
    dscp: number;
}

export interface LldpPeer {
    sysName?: string;
    sysDesc?: string;
    portId?: string;
    portDesc?: string;
    mgmtAddr?: string;
    /** LLDP-MED Extended Power-via-MDI TLVs observed in this frame (may be 1 or 2). */
    medPoE?: LldpMedPoE[];
    /** LLDP-MED Network Policy TLV(s) — switch's expected endpoint policy. */
    medPolicy?: LldpMedNetworkPolicy[];
}

const POE_PRIORITY = ["Unknown", "Critical", "High", "Low"];

export function parseLldp(data: Uint8Array, off: number): LldpPeer | null {
    const dv = dvOf(data);
    let p = off;
    const peer: LldpPeer = {};
    while (p + 2 <= data.length) {
        const hdr = dv.getUint16(p, false);
        const type = hdr >> 9;
        const len = hdr & 0x1ff;
        p += 2;
        if (type === 0) break;
        if (p + len > data.length) break;
        if (type === 5 && len >= 1) {
            peer.sysName = TEXT_DECODER.decode(data.subarray(p, p + len));
        } else if (type === 6 && len >= 1) {
            peer.sysDesc = TEXT_DECODER.decode(data.subarray(p, p + len));
        } else if (type === 2 && len >= 1) {
            const sub = data[p];
            const idBytes = data.subarray(p + 1, p + len);
            if (sub === 5 || sub === 7 || sub === 1 || sub === 2) {
                peer.portId = TEXT_DECODER.decode(idBytes);
            } else if (sub === 3 && idBytes.length === 6) {
                peer.portId = macStr(idBytes, 0);
            } else {
                peer.portId = Array.from(idBytes, b => b.toString(16).padStart(2, "0")).join("");
            }
        } else if (type === 4 && len >= 1) {
            peer.portDesc = TEXT_DECODER.decode(data.subarray(p, p + len));
        } else if (type === 8 && len >= 7) {
            // Management Address — first byte is addrlen, then 1 byte addr subtype, then addr.
            const addrLen = data[p];
            const addrSub = data[p + 1];
            if (addrSub === 1 && addrLen === 5 && p + 2 + 4 <= p + len) {
                peer.mgmtAddr = ipv4Str(data, p + 2);
            }
        } else if (type === 127 && len >= 4) {
            // Organizationally Specific TLV.
            const oui = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
            const sub = data[p + 3];
            // TIA LLDP-MED OUI = 00:12:bb.
            if (oui === 0x0012bb && sub === 4 && len >= 7) {
                // Extended Power-via-MDI.
                const flags = data[p + 4];
                const powerTypeBits = (flags >> 6) & 0x03;
                const powerSourceBits = (flags >> 4) & 0x03;
                const priorityBits = flags & 0x0f;
                const powerTenthW = (data[p + 5] << 8) | data[p + 6];
                const entry: LldpMedPoE = {
                    powerType: powerTypeBits === 0 ? "PSE" : powerTypeBits === 1 ? "PD" : "Unknown",
                    powerSource: powerSourceBits === 1 ? "Primary" : powerSourceBits === 2 ? "Backup" : "Unknown",
                    powerPriority: POE_PRIORITY[priorityBits] ?? "Unknown",
                    powerW: powerTenthW / 10,
                };
                (peer.medPoE ??= []).push(entry);
            } else if (oui === 0x0012bb && sub === 2 && len >= 8) {
                // Network Policy TLV: 1 byte app-type, then 3 bytes of packed flags+VLAN+L2pri+DSCP.
                const appType = data[p + 4];
                const b1 = data[p + 5], b2 = data[p + 6], b3 = data[p + 7];
                const flags = (b1 >> 6) & 0x03; // bit7=Unknown, bit6=Tagged
                const tagged = (b1 & 0x40) !== 0;
                const vlanId = ((b1 & 0x1f) << 7) | (b2 >> 1);
                const l2Priority = ((b2 & 0x01) << 2) | ((b3 >> 6) & 0x03);
                const dscp = b3 & 0x3f;
                if (flags !== 1) { // 1 = Unknown Policy bit set; skip those
                    (peer.medPolicy ??= []).push({ appType, tagged, vlanId, l2Priority, dscp });
                }
            }
        }
        p += len;
    }
    return (peer.sysName || peer.portId || peer.sysDesc || peer.mgmtAddr || peer.medPoE || peer.medPolicy) ? peer : null;
}

export interface CdpPeer {
    devId?: string;
    portId?: string;
}

export function parseCdp(data: Uint8Array, etherPayloadOff: number): CdpPeer | null {
    // CDP rides on LLC/SNAP: AA AA 03 00 00 0C 20 00, then CDP header (4 bytes), then TLVs.
    let off = etherPayloadOff;
    if (off + 12 > data.length) return null;
    if (!(data[off] === 0xaa && data[off + 1] === 0xaa && data[off + 2] === 0x03 &&
        data[off + 3] === 0x00 && data[off + 4] === 0x00 && data[off + 5] === 0x0c &&
        data[off + 6] === 0x20 && data[off + 7] === 0x00)) return null;
    off += 8 + 4; // skip SNAP + CDP fixed header
    const dv = dvOf(data);
    let devId: string | undefined;
    let portId: string | undefined;
    while (off + 4 <= data.length) {
        const t = dv.getUint16(off, false);
        const l = dv.getUint16(off + 2, false);
        if (l < 4 || off + l > data.length) break;
        const val = data.subarray(off + 4, off + l);
        if (t === 0x0001) devId = TEXT_DECODER.decode(val);
        else if (t === 0x0003) portId = TEXT_DECODER.decode(val);
        off += l;
    }
    return (devId || portId) ? { devId, portId } : null;
}

export interface EapolInfo {
    eapCode?: number;
}

export function parseEapol(data: Uint8Array, off: number): EapolInfo | null {
    if (data.length < off + 4) return null;
    const type = data[off + 1];
    if (type !== 0) return { eapCode: undefined };
    const eapOff = off + 4;
    if (data.length < eapOff + 4) return { eapCode: undefined };
    return { eapCode: data[eapOff] };
}

// ============================================================================
// IPv6
// ============================================================================

const IPV6_EXT_HEADERS = new Set([0, 43, 44, 50, 51, 60, 135, 139, 140, 253, 254]);

export interface Ipv6 {
    src: string;
    dst: string;
    /** Final next-header value after skipping extension headers. */
    nextHeader: number;
    payloadOff: number;
    payloadLen: number;
}

function ipv6Str(b: Uint8Array, off: number): string {
    const parts: string[] = [];
    for (let i = 0; i < 8; i++) parts.push(((b[off + i * 2] << 8) | b[off + i * 2 + 1]).toString(16));
    // Compress longest run of zeros.
    let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
    for (let i = 0; i < 8; i++) {
        if (parts[i] === "0") {
            if (curStart < 0) { curStart = i; curLen = 1; } else curLen++;
            if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
        } else { curStart = -1; curLen = 0; }
    }
    if (bestLen >= 2) {
        return parts.slice(0, bestStart).join(":") + "::" + parts.slice(bestStart + bestLen).join(":");
    }
    return parts.join(":");
}

export function parseIpv6(data: Uint8Array, off: number): Ipv6 | null {
    if (data.length < off + 40) return null;
    if ((data[off] >> 4) !== 6) return null;
    const payloadLenRaw = (data[off + 4] << 8) | data[off + 5];
    let nh = data[off + 6];
    const src = ipv6Str(data, off + 8);
    const dst = ipv6Str(data, off + 24);
    let p = off + 40;
    // Walk extension headers.
    for (let i = 0; i < 8 && IPV6_EXT_HEADERS.has(nh); i++) {
        if (p + 2 > data.length) return null;
        const next = data[p];
        const hdrLen = (data[p + 1] + 1) * 8; // most exts
        if (nh === 44) {
            // Fragment header is fixed 8 bytes.
            nh = next; p += 8; continue;
        }
        if (nh === 51) { // AH — length in 4-byte units, +2
            const ahLen = (data[p + 1] + 2) * 4;
            nh = next; p += ahLen; continue;
        }
        nh = next;
        p += hdrLen;
        if (p > data.length) return null;
    }
    const payloadOff = p;
    const payloadLen = Math.max(0, Math.min(payloadLenRaw - (p - off - 40), data.length - payloadOff));
    return { src, dst, nextHeader: nh, payloadOff, payloadLen };
}

export interface Icmpv6 {
    type: number;
    code: number;
    /** Target address for NS/NA messages. */
    targetAddr?: string;
}

export function parseIcmpv6(data: Uint8Array, off: number): Icmpv6 | null {
    if (data.length < off + 4) return null;
    const type = data[off];
    const code = data[off + 1];
    let targetAddr: string | undefined;
    if ((type === 135 || type === 136) && data.length >= off + 24) {
        targetAddr = ipv6Str(data, off + 8);
    }
    return { type, code, targetAddr };
}

// ============================================================================
// DHCPv6 (just message-type fingerprinting)
// ============================================================================

export const DHCPV6_MSG_NAMES: Record<number, string> = {
    1: "SOLICIT", 2: "ADVERTISE", 3: "REQUEST", 4: "CONFIRM",
    5: "RENEW", 6: "REBIND", 7: "REPLY", 8: "RELEASE",
    9: "DECLINE", 10: "RECONFIGURE", 11: "INFORMATION-REQUEST",
};

export function parseDhcpv6MessageType(data: Uint8Array, off: number, len: number): number | null {
    if (len < 1) return null;
    return data[off];
}

// ============================================================================
// IGMP (v2/v3)
// ============================================================================

export interface IgmpInfo {
    type: number;
    /** Multicast group address for v1/v2 messages. */
    group?: string;
    /** v3 reports may include many group records. */
    v3Groups?: string[];
}

export function parseIgmp(data: Uint8Array, off: number, len: number): IgmpInfo | null {
    if (len < 8) return null;
    const type = data[off];
    if (type === 0x22) {
        // IGMPv3 Membership Report — variable-length group records.
        if (len < 8) return { type };
        const groupCount = (data[off + 6] << 8) | data[off + 7];
        let p = off + 8;
        const v3Groups: string[] = [];
        for (let i = 0; i < groupCount && p + 8 <= off + len; i++) {
            const numSrc = (data[p + 2] << 8) | data[p + 3];
            const auxLen = data[p + 1];
            v3Groups.push(ipv4Str(data, p + 4));
            p += 8 + numSrc * 4 + auxLen * 4;
        }
        return { type, v3Groups };
    }
    // v1/v2: type, max resp time, checksum, group (4 bytes).
    const group = ipv4Str(data, off + 4);
    return { type, group };
}

// ============================================================================
// STP / BPDU (just topology-change detection)
// ============================================================================

export interface BpduInfo {
    /** 0x00 = Config BPDU, 0x02 = RSTP/MSTP, 0x80 = TCN. */
    bpduType: number;
    /** TC flag from Config BPDU flags byte. */
    topologyChange: boolean;
    /** Root bridge ID as "PRIO/AA:BB:CC:DD:EE:FF". Only populated on Config/RSTP BPDUs. */
    rootBridge?: string;
}

export function parseBpdu(data: Uint8Array, off: number): BpduInfo | null {
    // Expect LLC: DSAP=0x42, SSAP=0x42, ctrl=0x03 — then BPDU body.
    if (off + 3 > data.length) return null;
    if (data[off] !== 0x42 || data[off + 1] !== 0x42 || data[off + 2] !== 0x03) return null;
    const bpduOff = off + 3;
    if (bpduOff + 4 > data.length) return null;
    const bpduType = data[bpduOff + 3];
    if (bpduType === 0x80) return { bpduType, topologyChange: true };
    if (bpduOff + 13 > data.length) {
        const flags = bpduOff + 5 <= data.length ? data[bpduOff + 4] : 0;
        return { bpduType, topologyChange: (flags & 0x01) !== 0 };
    }
    const flags = data[bpduOff + 4];
    // Root bridge ID: 2 bytes priority+sys-id-ext, 6 bytes MAC, starting at bpduOff+5.
    const prio = (data[bpduOff + 5] << 8) | data[bpduOff + 6];
    const rootMac = macStr(data, bpduOff + 7);
    return {
        bpduType,
        topologyChange: (flags & 0x01) !== 0,
        rootBridge: `${prio}/${rootMac}`,
    };
}

// ============================================================================
// TLS — ClientHello fingerprinting (SNI / ALPN / version)
// ============================================================================

export interface TlsClientHello {
    sni?: string;
    alpn?: string[];
    /** TLS versions offered (post supported_versions or legacy_version). */
    versions: number[];
    /** True when `versions` came from the supported_versions extension rather than legacy_version. */
    versionsFromExtension: boolean;
}

export function isTlsGreaseValue(v: number): boolean {
    // RFC 8701: GREASE values have both bytes equal to 0x?A where the high nibble is identical.
    return (v & 0x0f0f) === 0x0a0a && ((v >> 4) & 0x0f) === ((v >> 12) & 0x0f);
}

export function parseTlsClientHello(payload: Uint8Array): TlsClientHello | null {
    let i = 0;
    const n = payload.length;
    while (i + 5 <= n) {
        const ctype = payload[i];
        const length = (payload[i + 3] << 8) | payload[i + 4];
        if (length === 0 || i + 5 + length > n) return null;
        if (ctype === 0x16 && length >= 4) {
            const hsType = payload[i + 5];
            if (hsType === 0x01) {
                const hsLen = (payload[i + 6] << 16) | (payload[i + 7] << 8) | payload[i + 8];
                return parseClientHelloBody(payload, i + 5 + 4, Math.min(hsLen, length - 4));
            }
        }
        i += 5 + length;
    }
    return null;
}

function parseClientHelloBody(p: Uint8Array, off: number, len: number): TlsClientHello | null {
    const result: TlsClientHello = { versions: [], versionsFromExtension: false };
    if (len < 34) return result;
    const end = off + len;
    result.versions = [(p[off] << 8) | p[off + 1]];
    let i = off + 2 + 32; // version + random
    if (i + 1 > end) return result;
    const sidLen = p[i]; i += 1 + sidLen;
    if (i + 2 > end) return result;
    const csLen = (p[i] << 8) | p[i + 1]; i += 2 + csLen;
    if (i + 1 > end) return result;
    const cmLen = p[i]; i += 1 + cmLen;
    if (i + 2 > end) return result;
    const extLen = (p[i] << 8) | p[i + 1]; i += 2;
    const extEnd = Math.min(i + extLen, end);
    while (i + 4 <= extEnd) {
        const type = (p[i] << 8) | p[i + 1];
        const eLen = (p[i + 2] << 8) | p[i + 3];
        i += 4;
        if (i + eLen > extEnd) break;
        if (type === 0x0000 && eLen >= 5) {
            // SNI: list_length (2) + (name_type (1) + name_length (2) + name)
            const nameType = p[i + 2];
            const nameLen = (p[i + 3] << 8) | p[i + 4];
            if (nameType === 0 && 5 + nameLen <= eLen) {
                result.sni = TEXT_DECODER.decode(p.subarray(i + 5, i + 5 + nameLen)).toLowerCase();
            }
        } else if (type === 0x0010 && eLen >= 2) {
            // ALPN
            const listLen = (p[i] << 8) | p[i + 1];
            const listEnd = Math.min(i + 2 + listLen, i + eLen);
            let j = i + 2;
            const alpns: string[] = [];
            while (j < listEnd) {
                const pLen = p[j];
                if (j + 1 + pLen > listEnd) break;
                alpns.push(TEXT_DECODER.decode(p.subarray(j + 1, j + 1 + pLen)));
                j += 1 + pLen;
            }
            if (alpns.length) result.alpn = alpns;
        } else if (type === 0x002b && eLen >= 1) {
            // supported_versions
            const sLen = p[i];
            const versions: number[] = [];
            for (let j = 0; j + 2 <= sLen && 1 + j + 2 <= eLen; j += 2) {
                versions.push((p[i + 1 + j] << 8) | p[i + 1 + j + 1]);
            }
            if (versions.length) {
                result.versions = versions;
                result.versionsFromExtension = true;
            }
        }
        i += eLen;
    }
    return result;
}

export function tlsVersionName(v: number): string {
    switch (v) {
        case 0x0301: return "TLS 1.0";
        case 0x0302: return "TLS 1.1";
        case 0x0303: return "TLS 1.2";
        case 0x0304: return "TLS 1.3";
        default:
            if ((v >> 8) === 0x7f) return `TLS 1.3 draft-${v & 0xff}`;
            return `0x${v.toString(16).padStart(4, "0")}`;
    }
}

// ============================================================================
// STUN
// ============================================================================

/** Returns true if the UDP payload starts with a STUN message (magic cookie present). */
export function isStunMessage(data: Uint8Array, off: number, len: number): boolean {
    if (len < 20) return false;
    // Bytes 0-1 are message type (first two bits must be 00 for STUN);
    // bytes 4-7 are magic cookie 0x2112A442.
    if ((data[off] & 0xc0) !== 0) return false;
    return data[off + 4] === 0x21 && data[off + 5] === 0x12 &&
        data[off + 6] === 0xa4 && data[off + 7] === 0x42;
}

// ============================================================================
// Plaintext HTTP request detection
// ============================================================================

const HTTP_METHODS = ["GET ", "POST", "PUT ", "HEAD", "OPTI", "DELE", "PATC", "CONN", "TRAC"];

/** Returns true if a TCP payload starts with what looks like an HTTP/1.x request line. */
export function looksLikeHttpRequest(data: Uint8Array, off: number, len: number): boolean {
    if (len < 16) return false;
    const prefix = String.fromCharCode(data[off], data[off + 1], data[off + 2], data[off + 3]);
    return HTTP_METHODS.includes(prefix);
}
