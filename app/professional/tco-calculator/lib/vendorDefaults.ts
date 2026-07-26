import type { SolutionInputs } from "./model";

// Per-vendor researched defaults, produced by RESEARCH_PROMPT.md and reviewed
// before merging across two research passes (a handful of claims from each
// were spot-checked live; Meraki, exacqVision, Avigilon H5SL, Milestone
// XPCODL/XPCOBT, and Genetec Omnicast Enterprise all confirmed exactly).
// Two researched vendors were deliberately left out:
// - Solink: priced per-location ($175/mo), not per-camera — genuinely
//   incompatible with this model's per-camera fields rather than just
//   unresearched, so it's dropped instead of force-fit.
// - BriefCam: an analytics add-on layered on top of another vendor's VMS, not
//   a VMS itself — no matching slot in the wizard's vmsProvider/cameraProvider
//   pickers to wire it into.
//
// Verkada is also deliberately absent from CLOUD_VENDOR_DEFAULTS: the generic
// defaults in lib/defaults.ts already ARE Verkada's numbers (see
// README.md's "Known softball risks"), sourced with better provenance than
// this file's secondary/reseller citations can match. A second research pass
// proposed a conflicting Verkada entry (applianceCost 6999/25ch — the real
// CC500 tier — vs. the existing 9999/50ch CC700 tier already baked into the
// generic defaults; tierPrice 899/5yr vs. the existing 1099/5yr, neither
// directly confirmable since Verkada's own pricing page doesn't publish
// per-channel license cost). Rather than silently overwrite known-good
// numbers with lower-confidence ones, it was left out; revisit only with a
// primary-sourced number.
//
// `fieldMeta` carries source/confidence/reasoning per field for future audit;
// it isn't surfaced in the UI today, only `values` is applied on selection.

export type FieldStatus = "sourced" | "estimated";
export type Confidence = "high" | "medium" | "low";

export interface FieldMeta {
  value: unknown;
  status: FieldStatus;
  confidence: Confidence;
  sources: string[];
  reasoning?: string;
  checkedOn: string;
}

// Picking (or pre-seeding) a vendor with researched data merges its values
// on top of whatever's already filled in; vendors without an entry here
// (including "Other") pass `sol` through untouched.
export function withVendorDefaults(sol: SolutionInputs, vendorName: string, table: Record<string, VendorDefaultEntry>): SolutionInputs {
  const entry = table[vendorName];
  return entry ? { ...sol, ...entry.values } : sol;
}

export interface VendorDefaultEntry {
  values: Partial<SolutionInputs>;
  fieldMeta: Record<string, FieldMeta>;
  notes?: string;
}

// ---------- CLOUD / HYBRID VMS ----------
export const CLOUD_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  "Meraki (Cisco)": {
    values: { migrationStrategy: "ripReplace", tierPrice: 900, tierYears: 5, cameraCost: 1299, supportAddonPerCamYr: 0, discountPct: 10 },
    fieldMeta: {
      migrationStrategy: { value: "ripReplace", status: "sourced", confidence: "high", sources: ["https://documentation.meraki.com/Platform_Management/Product_Information/Licensing/Meraki_Licensing_FAQs"], reasoning: "Meraki MV cameras are proprietary with on-camera storage; no third-party connector.", checkedOn: "2026-07-26" },
      tierPrice: { value: 900, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch", "https://documentation.meraki.com/Platform_Management/Product_Information/Licensing/Meraki_Licensing_FAQs"], reasoning: "5-yr MV license (SKU LIC-MV-5YR) $900 MSRP; confirmed directly ($300/1yr, $600/3yr, $900/5yr).", checkedOn: "2026-07-26" },
      tierYears: { value: 5, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], checkedOn: "2026-07-26" },
      cameraCost: { value: 1299, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], reasoning: "Indoor MV MSRP $1,299 (outdoor $1,499).", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "medium", sources: ["https://www.rhinonetworks.com/product/license/meraki-mv-license"], reasoning: "24x7 enterprise support bundled into license.", checkedOn: "2026-07-26" },
      discountPct: { value: 10, status: "sourced", confidence: "medium", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], reasoning: "Integrator street ~10% below MSRP.", checkedOn: "2026-07-26" },
    },
    notes: "Per-device license, one-time (no RMR). On-camera storage; no cloud storage tier, no connector.",
  },
  "Avigilon Alta (Motorola Solutions)": {
    values: { migrationStrategy: "connector", tierPrice: 179, tierYears: 1, cameraCost: 700, applianceCost: 500, applianceCapacity: 20, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.avigilon.com/vms/cloud"], reasoning: "Cloud Connector cloud-manages existing IP cameras; also sells native cameras.", checkedOn: "2026-07-26" },
      tierPrice: { value: 179, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "Alta subscription starts $179/cam/yr; ranges to $1,599/cam by term/retention.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "estimated", confidence: "medium", sources: [], reasoning: "$179 entry treated as a 1-yr baseline; multi-year discounts apply.", checkedOn: "2026-07-26" },
      cameraCost: { value: 700, status: "estimated", confidence: "low", sources: [], reasoning: "Alta domes street ~$600-950 (reseller/eBay listings); mid ~$700.", checkedOn: "2026-07-26" },
      applianceCost: { value: 500, status: "estimated", confidence: "low", sources: [], reasoning: "Cloud Connector gateway anchored to peer connector appliances $400-600.", checkedOn: "2026-07-26" },
      applianceCapacity: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "Typical connector supports 10-25 streams.", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "Support/updates bundled into Alta subscription.", checkedOn: "2026-07-26" },
    },
    notes: "30-day cloud storage included per camera. Formerly Ava Security; rebranded under Motorola Solutions.",
  },
  "Spot AI": {
    values: { migrationStrategy: "connector", tierPrice: 150, tierYears: 1, applianceCost: 499, applianceCapacity: 20, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.spot.ai/blog/video-surveillance-cost-roi"], reasoning: "Camera-agnostic; on-prem IVR/Vision Edge appliance processes existing cameras.", checkedOn: "2026-07-26" },
      tierPrice: { value: 150, status: "sourced", confidence: "medium", sources: ["https://nerdisa.com/spotai-co/"], reasoning: "Software license $100-200/cam/yr, mid $150.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "sourced", confidence: "medium", sources: ["https://nerdisa.com/spotai-co/"], reasoning: "Licenses offered in 1/3/5-yr terms.", checkedOn: "2026-07-26" },
      applianceCost: { value: 499, status: "sourced", confidence: "low", sources: ["https://crypto.huarenca.com/1731.html"], reasoning: "Vision Edge ~$499/unit reported (single anecdote).", checkedOn: "2026-07-26" },
      applianceCapacity: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "IVR/Edge typically ~16-32 cams.", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "medium", sources: ["https://www.spot.ai/pricing-information"], reasoning: "US-based support included.", checkedOn: "2026-07-26" },
    },
    notes: "Conflicting secondary figure ~$99/cam/mo exists; base uses the $100-200/cam/yr software-license line. BYO camera.",
  },
  "Coram AI": {
    values: { migrationStrategy: "connector", tierPrice: 270, tierYears: 1, cameraCost: 599, applianceCost: 600, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://techdraz.com/2025/07/25/coram-ai-pricing-a-comprehensive-guide-to-costs-and-value-for-ai-powered-video-security/"], reasoning: "Any IP camera + Coram Point edge appliance.", checkedOn: "2026-07-26" },
      tierPrice: { value: 270, status: "sourced", confidence: "medium", sources: ["https://customvideosecurity.com/shop-by-brand/coram-ai.html"], reasoning: "\"Coram AI Video feed license - 1 Year\" $270 (reseller).", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "sourced", confidence: "medium", sources: ["https://customvideosecurity.com/shop-by-brand/coram-ai.html"], reasoning: "1/3/5/10-yr terms offered.", checkedOn: "2026-07-26" },
      cameraCost: { value: 599, status: "sourced", confidence: "medium", sources: ["https://www.coram.ai/coram-ai-cloud-nvr"], reasoning: "Coram's own page states cameras range ~$599-999+; entry 4MP also sold at $431 (reseller); free cameras sometimes bundled with a Coram Point.", checkedOn: "2026-07-26" },
      applianceCost: { value: 600, status: "estimated", confidence: "low", sources: [], reasoning: "Coram Point is genuinely quote-only; Mini form factor supports up to 4 IP cameras; anchored to peer edge appliances $400-800.", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "Support bundled per reviews.", checkedOn: "2026-07-26" },
    },
    notes: "Safety Alert (weapon detection) $419/yr add-on (reseller).",
  },
  "Turing AI": {
    values: { migrationStrategy: "connector", tierYears: 1, cameraCost: 220 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.adiglobaldistribution.us/catalog/featured-brands/turing"], reasoning: "Compatible with existing VMS/3rd-party cameras; also sells own cameras/NVRs.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "sourced", confidence: "medium", sources: ["https://www.silmarelectronics.com/1-year-turing-core-ai-license/p144444/"], reasoning: "TV-CORE1Y 1-yr per-camera Core AI license SKU found; other terms (2/3/9-yr) also sold.", checkedOn: "2026-07-26" },
      cameraCost: { value: 220, status: "sourced", confidence: "medium", sources: ["https://www.newegg.com/Turing-Video-IP-Network-Cameras/BrandSubCat/ID-221443-3299"], reasoning: "4MP turret/dome ~$208-235.", checkedOn: "2026-07-26" },
    },
    notes: "Tiers Basic/Essential/Premium (Core AI). Exact license $ opaque at reseller, so tierPrice is left unset (falls through to the generic default).",
  },
  Arcules: {
    values: { migrationStrategy: "connector", applianceCost: 500, applianceCapacity: 25, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.networkwebcams.co.uk/arcules-subscription-acp1-1-7/"], reasoning: "Open platform, existing IP cameras + ARC2 gateway per site.", checkedOn: "2026-07-26" },
      applianceCost: { value: 500, status: "estimated", confidence: "low", sources: [], reasoning: "ARC2 gateway; peer anchor $400-600.", checkedOn: "2026-07-26" },
      applianceCapacity: { value: 25, status: "estimated", confidence: "low", sources: ["https://www.milestonesys.com/resources/content/articles/milestone-kite-arcules-vsaas-what-who/"], reasoning: "Positioned for up to ~50 cams/site; conservative midpoint.", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "SaaS support bundled.", checkedOn: "2026-07-26" },
    },
    notes: "Milestone-owned VSaaS, Google Cloud hosted. Quote-based per-channel; tiers by resolution + retention. tierPrice left unset (no public $, genuinely quote-only).",
  },
  Camio: {
    values: { migrationStrategy: "connector", tierPrice: 60, tierYears: 1, applianceCost: 500, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.camio.com/shop/"], reasoning: "BYO camera via RTSP/H.264; optional Camio Box on-prem connector.", checkedOn: "2026-07-26" },
      tierPrice: { value: 60, status: "sourced", confidence: "medium", sources: ["https://help.camio.com/hc/en-us/articles/205274239"], reasoning: "Plans start at $4.99/cam/month, ~$60/cam/yr entry.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "sourced", confidence: "medium", sources: ["https://help.camio.com/hc/en-us/articles/205274239"], reasoning: "Monthly/annual billing.", checkedOn: "2026-07-26" },
      applianceCost: { value: 500, status: "estimated", confidence: "low", sources: [], reasoning: "Camio Box connector; no clean unit price found; peer anchor.", checkedOn: "2026-07-26" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "Bundled; open API.", checkedOn: "2026-07-26" },
    },
    notes: "Usage-based; cost scales up with search/storage/labeling beyond the base tier. 30-day cloud history included in base.",
  },
  Rhombus: {
    values: { migrationStrategy: "ripReplace", tierPrice: 699, tierYears: 5, supportAddonPerCamYr: 0, cameraCost: 648, warrantyYears: 10, fleetHalfLifeYears: 10 },
    fieldMeta: {
      migrationStrategy: { value: "ripReplace", status: "sourced", confidence: "high", sources: ["https://www.rhombus.com/pricing/"], reasoning: "Camera-native, on-camera recording; no third-party-camera connector product, so onboarding means native cameras.", checkedOn: "2026-07-25" },
      tierPrice: { value: 699, status: "sourced", confidence: "high", sources: ["https://getsafeandsound.com/blog/rhombus-pricing/", "https://www.rhombus.com/pricing/"], reasoning: "Enterprise tier, 5yr per camera ($140/yr). Enterprise: $199/1yr, $699/5yr, $1,399/10yr; Professional $149/1yr; R600 multisensor license is 3x.", checkedOn: "2026-07-25" },
      tierYears: { value: 5, status: "sourced", confidence: "high", sources: ["https://getsafeandsound.com/blog/rhombus-pricing/"], checkedOn: "2026-07-25" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: ["https://www.rhombus.com/license-comparison/"], reasoning: "Enterprise license covers management/firmware/support/AI; cloud archiving and some AI are add-ons only on the lower Professional tier.", checkedOn: "2026-07-25" },
      cameraCost: { value: 648, status: "sourced", confidence: "medium", sources: ["https://butterflymx.com/blog/rhombus-camera-review/", "https://www.rhombus.com/pricing/"], reasoning: "Mid-range dome (R170/R200 band $499-648); entry R100/R120 $200-498, 4K/fisheye $899-1,648. Some listings bundle hardware + first license, so treat as hardware-only approximation.", checkedOn: "2026-07-25" },
      warrantyYears: { value: 10, status: "sourced", confidence: "high", sources: ["https://www.rhombus.com/pricing/"], reasoning: "\"All cameras include 10-year warranties.\"", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 10, status: "estimated", confidence: "low", sources: [], reasoning: "Generic modern-IP-camera assumption.", checkedOn: "2026-07-25" },
    },
    notes: "No NVR/DVR, no on-prem storage line — applianceCost left unset (n/a for the ripReplace path). Multi-year licensing saves up to ~30%, but that's a term discount, not negotiated off-list.",
  },
  "Eagle Eye Networks": {
    values: { migrationStrategy: "connector", tierPrice: 240, tierYears: 1, applianceCost: 1000, applianceCapacity: 20, applianceRefreshCycleYears: 5, supportAddonPerCamYr: 0, cameraCost: 400, warrantyYears: 3, fleetHalfLifeYears: 10 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.een.com/product/cloud-vms-subscriptions/"], reasoning: "Requires an on-site Bridge or CMVR appliance; reuses the existing ONVIF/PoE camera fleet.", checkedOn: "2026-07-25" },
      tierPrice: { value: 240, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/eagle-eye-networks-pricing/"], reasoning: "Native billing is per-camera-per-month, varying by resolution + retention (~$15-50/cam/mo band; ~$20/mo mid annualized to $240/yr). M10 ($5/mo) is the no-cloud-retention plan. Re-check against a current EEN price sheet before trusting in isolation.", checkedOn: "2026-07-25" },
      tierYears: { value: 1, status: "estimated", confidence: "high", sources: [], reasoning: "Native billing is monthly; 1yr chosen so tierPrice is a clean annualization.", checkedOn: "2026-07-25" },
      applianceCost: { value: 1000, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/eagle-eye-networks-pricing/"], reasoning: "Bridges/CMVRs run $500-2,000 by capacity; Bridge 303 ~$800-1,200 up to 20 cameras. CMVRs (with local storage) cost more.", checkedOn: "2026-07-25" },
      applianceCapacity: { value: 20, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/eagle-eye-networks-pricing/"], reasoning: "Bridge 303 supports up to 20 cameras; models offer 5/8/16/24 PoE ports.", checkedOn: "2026-07-25" },
      applianceRefreshCycleYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Appliance replacement warranties run ~2yr; 5yr is a reasonable refresh anchor.", checkedOn: "2026-07-25" },
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: ["https://www.een.com/product/cloud-vms-subscriptions/"], reasoning: "24/7 operational monitoring, web/mobile, and alerts included in the per-camera subscription.", checkedOn: "2026-07-25" },
      cameraCost: { value: 400, status: "estimated", confidence: "medium", sources: ["https://getsafeandsound.com/blog/eagle-eye-networks-pricing/"], reasoning: "Camera-agnostic; native/first-party cameras run $150-800. In a connector deployment cameraCost is really whichever third-party camera the operator chose.", checkedOn: "2026-07-25" },
      warrantyYears: { value: 3, status: "estimated", confidence: "low", sources: [], reasoning: "Depends on the third-party camera paired with it, not Eagle Eye itself.", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 10, status: "estimated", confidence: "low", sources: [], reasoning: "Generic modern-IP-camera assumption.", checkedOn: "2026-07-25" },
    },
    notes: "Fundamentally OpEx/monthly pricing; the annualization above is the main thing to re-check against a current price sheet. Camera-direct (no appliance) is allowed only for ≤6 cameras.",
  },
};

// ---------- ON-PREM VMS SOFTWARE ----------
export const ONPREM_VMS_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  "Exacq (Johnson Controls)": {
    values: { deviceLicense: 150, baseLicense: 0, carePct: 20, serverCost: 4000, serverCapacity: 64, storageCostPerTB: 30, raidLevel: "raid10" },
    fieldMeta: {
      deviceLicense: { value: 150, status: "sourced", confidence: "high", sources: ["https://ipvm.com/reports/exacq-increases-enterprise-vms-pricing"], reasoning: "Professional $150/cam (Enterprise $225) — confirmed directly.", checkedOn: "2026-07-26" },
      baseLicense: { value: 0, status: "sourced", confidence: "medium", sources: ["https://ipvm.com/reports/exacq-increases-enterprise-vms-pricing"], reasoning: "Per-camera model; Enterprise's separate server fee was dropped.", checkedOn: "2026-07-26" },
      carePct: { value: 20, status: "sourced", confidence: "high", sources: ["https://www.exacq.com/ssa/", "https://ipvm.com/reports/exacq-increases-enterprise-vms-pricing"], reasoning: "SSA ~20% of license/yr.", checkedOn: "2026-07-26" },
      serverCost: { value: 4000, status: "estimated", confidence: "low", sources: [], reasoning: "A/Z-series NVR appliance; generic 1U/2U anchor $3-5k.", checkedOn: "2026-07-26" },
      serverCapacity: { value: 64, status: "estimated", confidence: "low", sources: [], reasoning: "A-series scales to 128ch; conservative midpoint.", checkedOn: "2026-07-26" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic surveillance HDD $/TB.", checkedOn: "2026-07-26" },
      raidLevel: { value: "raid10", status: "estimated", confidence: "low", sources: [], reasoning: "Appliances ship RAID 5/6; raid10 is the closest enum match for parity redundancy.", checkedOn: "2026-07-26" },
    },
    notes: "Tiers Start/Professional/Enterprise. Perpetual per-camera. Z-series includes 5-yr SSA.",
  },
  "Digital Watchdog (DW Spectrum)": {
    values: { deviceLicense: 122, baseLicense: 0, carePct: 0, serverCost: 3000, serverCapacity: 64, storageCostPerTB: 30, raidLevel: "raid1" },
    fieldMeta: {
      deviceLicense: { value: 122, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1075696-REG/digital_watchdog_dw_spectrumlsc001_1_dw_spectrum_license.html"], reasoning: "Single-channel license (DW-SPECTRUMLSC001) $122 at B&H; reseller range $122-152.", checkedOn: "2026-07-26" },
      baseLicense: { value: 0, status: "sourced", confidence: "high", sources: ["https://www.surveillance-video.com/network-dw-spectrumlsc001.html"], reasoning: "Per-camera only; unlimited free live view.", checkedOn: "2026-07-26" },
      carePct: { value: 0, status: "sourced", confidence: "high", sources: ["https://www.surveillance-video.com/network-dw-spectrumlsc001.html"], reasoning: "Perpetual, \"no annual renewal fee, no upgrade fees.\"", checkedOn: "2026-07-26" },
      serverCost: { value: 3000, status: "estimated", confidence: "low", sources: [], reasoning: "Blackjack NVR pricing varies; generic anchor.", checkedOn: "2026-07-26" },
      serverCapacity: { value: 64, status: "estimated", confidence: "low", sources: [], reasoning: "Blackjack scales to 128ch.", checkedOn: "2026-07-26" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic.", checkedOn: "2026-07-26" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "low", sources: [], reasoning: "Default redundancy assumption.", checkedOn: "2026-07-26" },
    },
    notes: "Same codebase as Nx Witness (Network Optix OEM). DW Cloud included. An Enterprise subscription option also exists.",
  },
  "Network Optix (Nx Witness)": {
    values: { deviceLicense: 120, baseLicense: 0, carePct: 0, serverCost: 3000, serverCapacity: 64, storageCostPerTB: 30, raidLevel: "raid1" },
    fieldMeta: {
      deviceLicense: { value: 120, status: "estimated", confidence: "medium", sources: ["https://www.bhphotovideo.com/c/product/1075696-REG/digital_watchdog_dw_spectrumlsc001_1_dw_spectrum_license.html"], reasoning: "Exact Nx street price is reseller-quote-only; DW Spectrum (same codebase, Network Optix OEM) $122-152 used as a sourced peer anchor.", checkedOn: "2026-07-26" },
      baseLicense: { value: 0, status: "sourced", confidence: "high", sources: ["https://networkoptix.com/files/help/default/2/3/obtaining_and_activating_hd_witness_licenses.htm"], reasoning: "Per-camera; unlimited free live view.", checkedOn: "2026-07-26" },
      carePct: { value: 0, status: "sourced", confidence: "high", sources: ["https://www.securitywholesalers.com.au/product/nx-witness-professional-camera-licence/"], reasoning: "Perpetual, free lifetime updates, no recurring fees.", checkedOn: "2026-07-26" },
      serverCost: { value: 3000, status: "estimated", confidence: "low", sources: [], reasoning: "Software-only, runs on generic Intel/AMD server.", checkedOn: "2026-07-26" },
      serverCapacity: { value: 64, status: "estimated", confidence: "low", sources: [], reasoning: "Generic.", checkedOn: "2026-07-26" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic.", checkedOn: "2026-07-26" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "low", sources: [], reasoning: "Default redundancy assumption.", checkedOn: "2026-07-26" },
    },
    notes: "Software-only, camera-agnostic (ONVIF/RTSP). deviceLicense is peer-anchored to DW Spectrum, not directly quoted — spot-check before trusting it in isolation.",
  },
  "Hanwha Wisenet WAVE": {
    values: { deviceLicense: 165, baseLicense: 0, carePct: 0, serverCost: 3000, serverCapacity: 128, storageCostPerTB: 30, raidLevel: "raid1" },
    fieldMeta: {
      deviceLicense: { value: 165, status: "sourced", confidence: "high", sources: ["https://www.affinitechstore.com/hanwha-techwin-wave-professional-license-wave-pro-04/"], reasoning: "WAVE-PRO-01 MSRP $165 (street $107-155).", checkedOn: "2026-07-26" },
      baseLicense: { value: 0, status: "sourced", confidence: "high", sources: ["https://www.securitywholesalers.com.au/product/hanwha-wisenet-wave-1x-ip-camera-licence/"], reasoning: "Per-camera; multi-server failover requires no extra license.", checkedOn: "2026-07-26" },
      carePct: { value: 0, status: "sourced", confidence: "high", sources: ["https://www.a1securitycameras.com/samsung-wave-pro-01-pro-license-1-channel-license.html"], reasoning: "\"No annual & maintenance cost required,\" lifetime software upgrades.", checkedOn: "2026-07-26" },
      serverCost: { value: 3000, status: "estimated", confidence: "low", sources: [], reasoning: "Generic server or WAVE appliance.", checkedOn: "2026-07-26" },
      serverCapacity: { value: 128, status: "sourced", confidence: "medium", sources: ["https://www.securitywholesalers.com.au/product/hanwha-wisenet-wave-1x-ip-camera-licence/"], reasoning: "Up to 128 channels/server.", checkedOn: "2026-07-26" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic.", checkedOn: "2026-07-26" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "low", sources: [], reasoning: "Default redundancy assumption.", checkedOn: "2026-07-26" },
    },
    notes: "Perpetual per-camera, never expires. Bulk packs of 4/8/16/24/48. Native to Hanwha cameras but multi-vendor capable.",
  },
  Qognify: {
    values: { carePct: 20 },
    fieldMeta: {
      carePct: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "Enterprise VMS SMA ~20%/yr norm.", checkedOn: "2026-07-26" },
    },
    notes: "Ocularis (per-channel, edition-tiered) and VisionHub (enterprise/PSIM) are both quote-only; ~$100-200/ch class historically. deviceLicense left unset (no reliable public $). Hexagon-owned.",
  },
  "ISS (SecurOS)": {
    values: { deviceLicense: 66, baseLicense: 400, carePct: 20 },
    fieldMeta: {
      deviceLicense: { value: 66, status: "sourced", confidence: "medium", sources: ["https://www.a1securitycameras.com/iss-sox-cam-securos-xpress-camera-license.html"], reasoning: "SecurOS Xpress per-channel street price $66.18.", checkedOn: "2026-07-26" },
      baseLicense: { value: 400, status: "sourced", confidence: "low", sources: ["https://ipvm.com/reports/intelligent-security-systems-overview"], reasoning: "Xpress ~$400 base (IPVM report, dated ~2011 — directional only, not current list.", checkedOn: "2026-07-26" },
      carePct: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "SMA ~20%/yr; per-channel SMA ~$37 observed at reseller.", checkedOn: "2026-07-26" },
    },
    notes: "Base + per-channel, edition-tiered (Xpress/Pro/Enterprise). Pricing structure is dated (IPVM ~2011) — spot-check before trusting.",
  },
  "3xLOGIC (VIGIL)": {
    values: { deviceLicense: 99, baseLicense: 0, carePct: 15 },
    fieldMeta: {
      deviceLicense: { value: 99, status: "sourced", confidence: "high", sources: ["https://www.id-enhancements.com/3x-logic-vs-1ip-vigil-ip-camera-license/"], reasoning: "VS-1IP single IP channel license $99 MSRP.", checkedOn: "2026-07-26" },
      baseLicense: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "Flex-Channel model; channels configurable without an extra base fee on VIGIL recorders.", checkedOn: "2026-07-26" },
      carePct: { value: 15, status: "estimated", confidence: "low", sources: [], reasoning: "Mid-market VMS maintenance norm ~15%.", checkedOn: "2026-07-26" },
    },
    notes: "Flex-Channel licensing (analog/HD-analog/IP interchangeable). Also sold via ADI (IA-VS1IP).",
  },
  "Milestone XProtect": {
    values: { deviceLicense: 329, baseLicense: 3342, carePct: 18, serverCost: 10000, serverCapacity: 100, storageCostPerTB: 30, raidLevel: "raid1", refreshCycleYears: 5 },
    fieldMeta: {
      deviceLicense: { value: 329, status: "sourced", confidence: "high", sources: ["https://telecomcreations.com/products/milestone-xpcodl-xprotect-corporate-device-license-stock-xpcodl"], reasoning: "XPCODL per-device one-time perpetual license, confirmed directly at $329. List/street varies by reseller.", checkedOn: "2026-07-26" },
      baseLicense: { value: 3342, status: "sourced", confidence: "high", sources: ["https://www.affinitechstore.com/milestone-xprotect-corporate-base-license-xpcobt/"], reasoning: "XPCOBT Corporate base server license, confirmed directly at $3,342 MSRP (education/REMC pricing seen as low as $2,406.24).", checkedOn: "2026-07-26" },
      carePct: { value: 18, status: "estimated", confidence: "medium", sources: ["https://www.bhphotovideo.com/c/product/1145408-REG/milestone_yxpcodl_xprotect_corporate_device_channel.html"], reasoning: "Milestone Care Plus (the SUP) is mandatory for Corporate for at least year 1, priced as a separate per-device SKU. Industry pattern for Milestone SUP is ~15-20% of license MSRP/yr; Care Premium (24/7) is an additional layer on top.", checkedOn: "2026-07-25" },
      serverCost: { value: 10000, status: "estimated", confidence: "low", sources: [], reasoning: "XProtect Corporate runs on generic/customer server hardware (no Milestone-branded server SKU); generic enterprise recording-server anchor.", checkedOn: "2026-07-25" },
      serverCapacity: { value: 100, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; heavily bitrate-dependent.", checkedOn: "2026-07-25" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic surveillance-storage market number, not vendor-specific.", checkedOn: "2026-07-25" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "medium", sources: [], reasoning: "Default assumption; Corporate supports failover recording servers for mission-critical builds.", checkedOn: "2026-07-25" },
      refreshCycleYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Typical server/appliance refresh.", checkedOn: "2026-07-25" },
    },
    notes: "Perpetual license + SUP model; Care Plus is effectively non-optional for Corporate. Device-license count follows Milestone's supported-hardware rules (multi-sensor/encoder devices can need more than one license). Analytics are largely partner/marketplace, not a single first-party SKU — left unset.",
  },
  "Genetec Security Center": {
    values: { deviceLicense: 250, baseLicense: 3650, carePct: 19, serverCost: 10000, serverCapacity: 100, storageCostPerTB: 30, raidLevel: "raid1", refreshCycleYears: 5 },
    fieldMeta: {
      deviceLicense: { value: 250, status: "sourced", confidence: "high", sources: ["https://docrack.me/genetec-security-center-license-calculator.html"], reasoning: "Omnicast Enterprise per-camera connection license, confirmed directly at $250 (Standard $150/cam, Professional $230/cam; Enterprise offers unlimited cameras, the right tier for a large fleet).", checkedOn: "2026-07-26" },
      baseLicense: { value: 3650, status: "sourced", confidence: "high", sources: ["https://docrack.me/genetec-security-center-license-calculator.html"], reasoning: "Omnicast Enterprise base package (unlimited cameras/servers/clients), confirmed directly at $3,650 (Standard $590, Professional $1,130).", checkedOn: "2026-07-26" },
      carePct: { value: 19, status: "sourced", confidence: "medium", sources: ["https://www.dhs.gov/sites/default/files/publications/VMS-MSR_1214-508.pdf"], reasoning: "Genetec Advantage (the SMA) is required at initial purchase. DHS VMS market survey lists Enterprise maintenance at $400 base + $48/cam/yr; $48 on a $250/cam license is ~19%. Covers version upgrades + GTAC support.", checkedOn: "2026-07-25" },
      serverCost: { value: 10000, status: "estimated", confidence: "low", sources: [], reasoning: "Genetec sells Streamvault appliances but pricing is quote-only; generic server-hardware anchor.", checkedOn: "2026-07-25" },
      serverCapacity: { value: 100, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; bitrate-dependent.", checkedOn: "2026-07-25" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic.", checkedOn: "2026-07-25" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "medium", sources: [], reasoning: "Default assumption; Genetec supports archiver redundancy/failover.", checkedOn: "2026-07-25" },
      refreshCycleYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Typical.", checkedOn: "2026-07-25" },
    },
    notes: "Enterprise tier assumed (right fit for a large fleet). Genetec also has a SaaS/hybrid path (Security Center SaaS: $149-199/cam/yr + Cloudlink appliances $1,395-4,630) — that would be a separate cloud-side entry, not this on-prem one. Analytics are add-on/partner, left unset.",
  },
  "Avigilon Control Center (Motorola Solutions)": {
    values: { deviceLicense: 292, baseLicense: 0, carePct: 10, serverCost: 10155, serverCapacity: 76, storageCostPerTB: 30, raidLevel: "raid1", refreshCycleYears: 5 },
    fieldMeta: {
      deviceLicense: { value: 292, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "ACC7 Enterprise per-camera license MSRP; SLED/cooperative bid pricing seen as low as $212.70. Core tier (entry, 16-cam cap) runs ~$80/ch.", checkedOn: "2026-07-25" },
      baseLicense: { value: 0, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/", "https://ipvm.com/reports/avigilons-price-competitiveness"], reasoning: "ACC is licensed per camera channel; unlike Genetec/Milestone Corporate there's no separate base-license line.", checkedOn: "2026-07-25" },
      carePct: { value: 10, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "Smart Assurance Plan runs $21-30/license/yr, ~10% of license. Historically Avigilon had no mandatory maintenance (IPVM 2011); SAP is now the common-but-optional upgrade path, so 10% is the realistic ongoing figure (0% if the customer forgoes upgrades).", checkedOn: "2026-07-25" },
      serverCost: { value: 10155, status: "sourced", confidence: "low", sources: ["https://www.ebay.de/itm/116441299996"], reasoning: "Avigilon HD NVR4X Standard, 48TB, 76-camera-licensed, seen at $10,155 on the secondary market. Avigilon does sell purpose-built NVR/HD appliances so this is a real anchor, but it's a used-market listing — verify against a current NVR SKU list before trusting closely.", checkedOn: "2026-07-25" },
      serverCapacity: { value: 76, status: "sourced", confidence: "low", sources: ["https://www.ebay.de/itm/116441299996"], reasoning: "That specific NVR4X unit was 76-camera-licensed; capacity varies by model/bitrate.", checkedOn: "2026-07-25" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; Avigilon NVRs bundle storage, so per-TB only matters if sizing separately.", checkedOn: "2026-07-25" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "medium", sources: [], reasoning: "Default assumption; Avigilon NVRs ship RAID-configured.", checkedOn: "2026-07-25" },
      refreshCycleYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Typical.", checkedOn: "2026-07-25" },
    },
    notes: "Avigilon Alta is the cloud sibling ($179/1yr, $499/3yr, $799/5yr, $1,599/10yr per camera incl. 30-day storage — see CLOUD_VENDOR_DEFAULTS' \"Avigilon Alta (Motorola Solutions)\" entry, sourced separately). Analytics (Appearance Search, Unusual Activity Detection) are largely built into ACC Enterprise / self-learning cameras, not a separate SKU. SLED buyers save ~27-28% off MSRP via PEPPM/CMAS-type vehicles.",
  },
};

// ---------- ON-PREM CAMERA HARDWARE ----------
// Each anchored to a representative mid-tier ~4-5MP fixed dome/turret.
export const ONPREM_CAMERA_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  Hikvision: {
    values: { cameraCost: 130, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 130, status: "sourced", confidence: "high", sources: ["https://www.hikdistribution.com/products/4-mp-powered-by-darkfighter-fixed-dome-network-camera-hikvision-ds-2cd2145fwd-is"], reasoning: "DS-2CD2145FWD-IS (4MP fixed dome, EXIR, IP67/IK10) $130 reseller; street $120-160 by lens.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Hikvision US warranty commonly 3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: DS-2CD2145FWD-IS. NDAA-restricted (US federal).",
  },
  "Dahua Technology": {
    values: { cameraCost: 159, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 159, status: "sourced", confidence: "medium", sources: ["https://www.icctvzone.com/ipc-hdbw3441r-as-p.html"], reasoning: "IPC-HDBW3441R-AS-P (4MP WizSense starlight fixed dome) ~$159 street.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Dahua standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: IPC-HDBW3441R-AS-P. NDAA-restricted. Variants $100-330 by lens/seller.",
  },
  Uniview: {
    values: { cameraCost: 135, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 135, status: "sourced", confidence: "medium", sources: ["https://lowvoltagedealer.com/products/uniview-ipc3614sr3-adf28km-g"], reasoning: "IPC3614SR3-ADF28KM-G (4MP LightHunter turret/eyeball) $125-150 street.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Uniview standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: IPC3614SR3-ADF28KM-G. NDAA-compliant (unlike Hikvision/Dahua) — relevant for US federal/education buyers.",
  },
  "Bosch Security": {
    values: { cameraCost: 562, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 562, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1363699-REG/bosch_nde_5503_al_flexidome_ip_outdoor_5000i.html"], reasoning: "FLEXIDOME IP outdoor 5000i (NDE-5503-AL, 5MP, IP66/IK10) $562.49 street at B&H; MSRP ~$1,027.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Bosch standard 3-yr (extendable).", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: NDE-5503-AL. Built-in Essential Video Analytics. Large list-to-street gap ($1,027 MSRP vs $562 street).",
  },
  "i-PRO (ex-Panasonic)": {
    values: { cameraCost: 700, warrantyYears: 5 },
    fieldMeta: {
      cameraCost: { value: 700, status: "estimated", confidence: "low", sources: ["https://cookandboardman.com/i-pro-extreme-wv-s2250l-5-mp-dome-network-camera-discontinued/"], reasoning: "WV-S2250L (5MP vandal dome) discontinued; listed MSRP ~$1,199, now ~$1,007; mid-tier street estimate ~$600-800.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 5, status: "sourced", confidence: "high", sources: ["https://cookandboardman.com/i-pro-extreme-wv-s2250l-5-mp-dome-network-camera-discontinued/"], reasoning: "5-year limited warranty on spec.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model discontinued (WV-S2250L; successor WV-S2252L) — SPOT-CHECK against a live quote before trusting cameraCost.",
  },
  Vivotek: {
    values: { cameraCost: 300, warrantyYears: 5 },
    fieldMeta: {
      cameraCost: { value: 300, status: "estimated", confidence: "low", sources: ["https://www.vivotek.com/en-US/products/network-cameras/dome"], reasoning: "FD9367 (2MP) street $200-260; 5MP sibling FD9388-HTV typically ~$300-350.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Vivotek pro cameras 3-5yr; upper bound used.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: FD9388-HTV (swapped in for the 2MP FD9367 to hit the 4-5MP anchor tier).",
  },
  Pelco: {
    values: { cameraCost: 530, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 530, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com"], reasoning: "Sarix Professional 4 SRXP4-5V10-IMD-IR (5MP indoor dome) street $533.99 (Surveillance-Video), $562.49 (B&H), $504 sale (Tech-America).", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Pelco standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: SRXP4-5V10-IMD-IR. Motorola/Pelco channel.",
  },
  Honeywell: {
    values: { cameraCost: 760, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 760, status: "sourced", confidence: "medium", sources: ["https://www.multioculus.com/Products/overview/M020807531"], reasoning: "HC30WB5R2 (5MP, 30 Series bullet) MSRP $760; dome sibling HC30WE5R2 is same series/class but not individually confirmed.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Honeywell standard multi-year.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: 30 Series HC30WE5R2 (MSRP anchored to bullet sibling HC30WB5R2, not confirmed individually). NDAA-compliant.",
  },
  "Avigilon (Cameras)": {
    values: { cameraCost: 850, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 850, status: "estimated", confidence: "low", sources: ["https://www.newegg.com"], reasoning: "Exact 5.0 H5A dome is quote-only; nearest published anchors are the value-line 5MP H5SL dome (5.0C-H5SL-DO1-IR, confirmed $579 on Newegg) and the 6MP H5A ($879); mid estimate ~$850 for the analytics-heavy H5A.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Avigilon standard ~3-yr (extendable).", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: H5A dome (5.0C-H5A-DO1-IR). Distinct from Avigilon Control Center VMS — this is the camera-hardware brand. H5A is the premium analytics line; H5SL is the value line ($579, confirmed). SPOT-CHECK cameraCost before trusting.",
  },
  "Axis Communications": {
    values: { cameraCost: 750, warrantyYears: 3, fleetHalfLifeYears: 12 },
    fieldMeta: {
      cameraCost: { value: 750, status: "sourced", confidence: "medium", sources: ["https://www.ebay.com/p/27076682133", "https://www.cdw.com/product/axis-p3267-lv-cpnt-5mp-network-camera/6906298"], reasoning: "AXIS P3267-LV (02329-001, 5MP indoor fixed dome, ARTPEC-8, varifocal 3-8mm, IK10) street mid-point. Open-box $721.98 (eBay); 5MP predecessor P3247-LV $500 new; authorized resellers (CDW, Full Compass, A1 Security) list the SKU without public price. Axis doesn't publish MSRP openly; list runs somewhat higher than this street mid-point. Note: P3267-LV is being phased out by Axis, a current-gen equivalent may reprice.", checkedOn: "2026-07-25" },
      warrantyYears: { value: 3, status: "sourced", confidence: "medium", sources: ["https://www.axis.com/products/axis-p3265-lv/support"], reasoning: "Axis standard hardware warranty is 3 years, extendable to 5 via registration/extension. Changes when replacement cost (vs. labor-only) kicks in — spot-check whether 3 or 5 fits the deal.", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 12, status: "estimated", confidence: "low", sources: [], reasoning: "Axis's reliability reputation supports a longer-than-generic half-life; anchored above the 10 used elsewhere, not sourced.", checkedOn: "2026-07-25" },
    },
    notes: "Priced model: AXIS P3267-LV. The 2MP P3265-LV sibling runs ~$500-600 street if a matched-resolution comparison against a cheaper competitor is wanted instead.",
  },
  "Hanwha Vision": {
    values: { cameraCost: 850, warrantyYears: 5, fleetHalfLifeYears: 10 },
    fieldMeta: {
      cameraCost: { value: 850, status: "sourced", confidence: "medium", sources: ["https://www.bhphotovideo.com/c/product/1336781-REG/hanwha_techwin_xnd_8080rv_5mp_indoor_ir_vandal.html", "https://www.a1securitycameras.com/samsung-xnd-8080rv.html"], reasoning: "Hanwha Wisenet XND-8080RV (5MP indoor vandal dome, Wisenet 5, varifocal 3.9-9.4mm, IK08) street $819 (B&H) to $972-996 (other resellers) against a $1,350 MSRP; $850 sits near the low street end. This is a Wisenet-5-generation model — the current Wisenet-7 equivalent (XND-8082 family) may reprice.", checkedOn: "2026-07-25" },
      warrantyYears: { value: 5, status: "estimated", confidence: "medium", sources: ["https://www.a1securitycameras.com/samsung-xnd-8080rv.html"], reasoning: "Hanwha's North America Wisenet warranty program is commonly 5 years, though one reseller listing showed \"3 Year Warranty\" for this exact SKU — flagged discrepancy, confirm against Hanwha's current terms for the target region before trusting closely.", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 10, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; roughly on par with commodity-premium IP domes.", checkedOn: "2026-07-25" },
    },
    notes: "Priced model: XND-8080RV. Distinct from the \"Hanwha Wisenet WAVE\" entry in ONPREM_VMS_VENDOR_DEFAULTS — that's the VMS software, this is the camera-hardware brand. Country of origin listed as China for this model, which matters for NDAA/procurement filtering in some federal/education contexts even though Hanwha itself is South Korean.",
  },
};
