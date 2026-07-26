import type { SolutionInputs } from "./model";

// Per-vendor researched defaults, produced by RESEARCH_PROMPT.md and reviewed
// before merging across two research passes (a handful of claims from each
// were spot-checked live; Meraki, exacqVision, Avigilon H5SL, Milestone
// XPCODL/XPCOBT, and Genetec Omnicast Enterprise all confirmed exactly).
// Two researched vendors were deliberately left out:
// - Solink: priced per-location ($175/mo), not per-camera; genuinely
//   incompatible with this model's per-camera fields rather than just
//   unresearched, so it's dropped instead of force-fit.
// - BriefCam: an analytics add-on layered on top of another vendor's VMS, not
//   a VMS itself, so there's no matching slot in the wizard's
//   vmsProvider/cameraProvider pickers to wire it into.
//
// Verkada is also deliberately absent from CLOUD_VENDOR_DEFAULTS: the generic
// defaults in lib/defaults.ts already ARE Verkada's numbers (see
// README.md's "Known softball risks"), sourced with better provenance than
// this file's secondary/reseller citations can match. A second research pass
// proposed a conflicting Verkada entry (applianceCost 6999/25ch, the real
// CC500 tier, vs. the existing 9999/50ch CC700 tier already baked into the
// generic defaults; tierPrice 899/5yr vs. the existing 1099/5yr, neither
// directly confirmable since Verkada's own pricing page doesn't publish
// per-channel license cost). Rather than silently overwrite known-good
// numbers with lower-confidence ones, it was left out; revisit only with a
// primary-sourced number.
//
// `fieldMeta` carries source/confidence/reasoning per field for future audit;
// it isn't surfaced in the UI today, only `values` is applied on selection.
//
// On "Verkada parity" (matching Verkada's all-inclusive bundle for a fair
// total-cost comparison, since most real usage of this calculator is Verkada
// vs. one competitor): a third research pass proposed doing this by
// re-pricing every vendor's tierPrice/deviceLicense to a normalized,
// support+analytics-bundled "parity" figure. That was rejected: it
// contradicts this model's whole point (tierPrice is base license only;
// supportAddonPerCamYr and analyticsSoftwareCost exist specifically so a
// bundled-vs-unbundled gap stays visible instead of getting silently folded
// into one number), and in Meraki's case it substituted an unverified,
// differently-scoped "Enterprise" SKU figure for one already confirmed live.
// The right way to close a real parity gap is to populate the existing
// separate add-on field with the actual cost of the missing piece, which the
// calculator already sums into the total; see Meraki's supportAddonPerCamYr
// (MV Sense analytics, confirmed live) for the template. Apply this pattern
// to another vendor only with equally direct evidence that something
// Verkada bundles for free is a real, separately-priced SKU for that vendor;
// don't infer a gap without a citation for the missing piece specifically.

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

// Looks up a single field's provenance across whichever vendor entries could
// have set it (on-prem has a separate VMS-vendor entry and camera-vendor
// entry; cloud has just the one). Only returns metadata if the field's
// CURRENT value still matches what that vendor's research produced; if the
// user has since edited it, showing "sourced" next to a number they typed
// themselves would be a worse lie than showing nothing, so it deliberately
// goes stale the moment the value changes rather than tracking edits some
// other way.
export function fieldSourceInfo(
  key: keyof SolutionInputs,
  currentValue: unknown,
  ...entries: (VendorDefaultEntry | undefined)[]
): FieldMeta | null {
  for (const entry of entries) {
    if (!entry) continue;
    if (!(key in entry.values)) continue;
    if ((entry.values as Record<string, unknown>)[key] !== currentValue) continue;
    return entry.fieldMeta[key] ?? null;
  }
  return null;
}

export interface ConfidenceSummary {
  sourced: number;
  total: number;
  label: string;
  tone: "sourced" | "mixed" | "estimated" | "none";
}

// Collapses a vendor's per-field fieldMeta into a single at-a-glance figure;
// the underlying source/confidence detail stays in fieldMeta for anyone who
// wants it, this just makes "how much of this is real vs. a guess" visible
// without reading the data file. `total: 0` (no entry at all, or "Other")
// means generic, not-vendor-specific defaults, not zero sourced fields.
//
// `headlineField`, if given, is checked for presence in `values` first and
// short-circuits to a distinct "not researched" state if it's missing;
// otherwise a vendor whose price field was never researched (e.g. Turing AI
// and Arcules's tierPrice, silently falling through to the generic default)
// could still show a reassuring "3/3 sourced" based only on the fields that
// *are* present, which is a worse, more confident-looking lie than showing
// nothing at all.
export function confidenceSummary(
  vendorName: string,
  table: Record<string, VendorDefaultEntry>,
  headlineField?: keyof SolutionInputs
): ConfidenceSummary {
  const entry = table[vendorName];
  if (!entry) return { sourced: 0, total: 0, label: "Generic defaults, not vendor-specific", tone: "none" };
  const metas = Object.values(entry.fieldMeta);
  const total = metas.length;
  const sourced = metas.filter((m) => m.status === "sourced").length;
  if (headlineField !== undefined && !(headlineField in entry.values)) {
    return { sourced, total, label: "Price not researched, using generic default", tone: "estimated" };
  }
  const tone: ConfidenceSummary["tone"] = total === 0 ? "none" : sourced === total ? "sourced" : sourced === 0 ? "estimated" : "mixed";
  return { sourced, total, label: total === 0 ? "Generic defaults, not vendor-specific" : `${sourced}/${total} fields sourced`, tone };
}

export interface VendorDefaultEntry {
  values: Partial<SolutionInputs>;
  fieldMeta: Record<string, FieldMeta>;
  notes?: string;
}

// ---------- CLOUD / HYBRID VMS ----------
export const CLOUD_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  "Meraki (Cisco)": {
    values: { migrationStrategy: "ripReplace", tierPrice: 900, tierYears: 5, cameraCost: 1499, supportAddonPerCamYr: 110.59, discountPct: 10 },
    fieldMeta: {
      migrationStrategy: { value: "ripReplace", status: "sourced", confidence: "high", sources: ["https://documentation.meraki.com/Platform_Management/Product_Information/Licensing/Meraki_Licensing_FAQs"], reasoning: "Meraki MV cameras are proprietary with on-camera storage; no third-party connector.", checkedOn: "2026-07-26" },
      tierPrice: { value: 900, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch", "https://documentation.meraki.com/Platform_Management/Product_Information/Licensing/Meraki_Licensing_FAQs"], reasoning: "5-yr MV license (SKU LIC-MV-5YR) $900 MSRP; confirmed directly ($300/1yr, $600/3yr, $900/5yr). This is the base license only; 24x7 support is bundled at this price, but it does NOT include MV Sense analytics (see supportAddonPerCamYr).", checkedOn: "2026-07-26" },
      tierYears: { value: 5, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], checkedOn: "2026-07-26" },
      cameraCost: { value: 1499, status: "sourced", confidence: "high", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], reasoning: "Outdoor MV MSRP $1,499 (indoor is cheaper at $1,299); switched to outdoor for consistency with the outdoor-rated spec used across the on-prem camera table.", checkedOn: "2026-07-27" },
      supportAddonPerCamYr: { value: 110.59, status: "sourced", confidence: "medium", sources: ["https://www.cdw.com/product/cisco-meraki-mv-sense-subscription-license-3-years-1-license/5388198", "https://www.lttpartners.com/products/cisco-meraki-mv-sense-license"], reasoning: "24x7 enterprise SUPPORT is bundled into the base license (confirmed), but Meraki's base MV license does not include camera analytics comparable to what Verkada bundles by default (people/vehicle search); that requires the separately-sold MV Sense license. 3yr MV Sense list price confirmed directly at $331.16 (LIC-MV-SEN-3YR); the matching 5yr list figure ($552.93, to align with this entry's tierYears:5) comes from the same distributor ladder, not independently reconfirmed at 5yr specifically. Annualized: $552.93 / 5 = $110.59/cam/yr. Without this, an unedited comparison understates Meraki's cost to actually match Verkada's out-of-the-box capability.", checkedOn: "2026-07-27" },
      discountPct: { value: 10, status: "sourced", confidence: "medium", sources: ["https://ipvm.com/discussions/cisco-meraki-camera-launch"], reasoning: "Integrator street ~10% below MSRP.", checkedOn: "2026-07-26" },
    },
    notes: "Per-device license, one-time (no RMR). On-camera storage; no cloud storage tier, no connector. supportAddonPerCamYr captures MV Sense (the analytics parity gap vs. Verkada's bundled analytics) rather than folding it into tierPrice, so the base license stays comparable across vendors and the add-on stays visible/editable on its own line.",
  },
  "Avigilon Alta (Motorola Solutions)": {
    values: { migrationStrategy: "connector", tierPrice: 179, tierYears: 1, cameraCost: 1368, applianceCost: 5300, applianceCapacity: 25, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.avigilon.com/vms/cloud"], reasoning: "Cloud Connector cloud-manages existing IP cameras; also sells native cameras.", checkedOn: "2026-07-26" },
      tierPrice: { value: 179, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "Alta subscription starts $179/cam/yr; ranges to $1,599/cam by term/retention.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "estimated", confidence: "medium", sources: [], reasoning: "$179 entry treated as a 1-yr baseline; multi-year discounts apply.", checkedOn: "2026-07-26" },
      cameraCost: { value: 1368, status: "sourced", confidence: "high", sources: ["https://www.lttpartners.com/products/avigilon-alta-h6sl-dome-outdoor-camera-5mp"], reasoning: "Alta H6SL Dome Outdoor 5MP $1,368, confirmed directly, matching the 5MP-outdoor spec used across the on-prem camera table instead of an unsourced street-price guess.", checkedOn: "2026-07-27" },
      applianceCost: { value: 5300, status: "sourced", confidence: "high", sources: ["https://www.lttpartners.com/products/avigilon-alta-a600-cloud-connector"], reasoning: "Alta A600 Cloud Connector (8TB) $5,300, confirmed directly (16TB variant $6,200).", checkedOn: "2026-07-27" },
      applianceCapacity: { value: 25, status: "sourced", confidence: "high", sources: ["https://www.lttpartners.com/products/avigilon-alta-a600-cloud-connector"], reasoning: "A600 supports 25 cameras, confirmed directly.", checkedOn: "2026-07-27" },
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "medium", sources: ["https://ipvm.com/discussions/avigilon-appearance-search-5ff32c7c-e53b-4b77-95de-1ab6552ab3f7"], reasoning: "Face Search specifically confirmed as a $0-license-cost feature. Mixed signal elsewhere: Avigilon's own marketing describes analytics as modular \"additional modules\" with pricing that \"scales... with feature depth,\" which could mean some deeper analytics tier is paid, but no specific dollar figure for any such module was found despite a targeted search, so nothing is added here. Revisit if a real number for a specific paid analytics module ever turns up.", checkedOn: "2026-07-27" },
    },
    notes: "30-day cloud storage included per camera. Formerly Ava Security; rebranded under Motorola Solutions. Rack-mounted connectors scale to 200 cameras for larger deployments; A600 is the representative mid-tier unit used here.",
  },
  "Spot AI": {
    values: { migrationStrategy: "connector", tierPrice: 150, tierYears: 1, applianceCost: 2199, applianceCapacity: 32, supportAddonPerCamYr: 0 },
    fieldMeta: {
      migrationStrategy: { value: "connector", status: "sourced", confidence: "high", sources: ["https://www.spot.ai/blog/video-surveillance-cost-roi"], reasoning: "Camera-agnostic; on-prem Enterprise NVR appliance processes existing cameras.", checkedOn: "2026-07-26" },
      tierPrice: { value: 150, status: "sourced", confidence: "medium", sources: ["https://nerdisa.com/spotai-co/"], reasoning: "Software license $100-200/cam/yr, mid $150.", checkedOn: "2026-07-26" },
      tierYears: { value: 1, status: "sourced", confidence: "medium", sources: ["https://nerdisa.com/spotai-co/"], reasoning: "Licenses offered in 1/3/5-yr terms.", checkedOn: "2026-07-26" },
      applianceCost: { value: 2199, status: "sourced", confidence: "high", sources: ["https://www.spot.ai/blog/introducing-spot-ai-enterprise-nvr"], reasoning: "Spot AI Enterprise NVR (current flagship appliance, NVIDIA GPU on-device analytics) starts at $2,199, confirmed directly, replacing the prior single-anecdote figure for an older/smaller \"Vision Edge\" unit.", checkedOn: "2026-07-27" },
      applianceCapacity: { value: 32, status: "sourced", confidence: "high", sources: ["https://www.spot.ai/blog/introducing-spot-ai-enterprise-nvr"], reasoning: "Enterprise NVR supports up to 32 cameras per appliance, confirmed directly.", checkedOn: "2026-07-27" },
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "medium", sources: ["https://www.spot.ai/pricing-information"], reasoning: "US-based support included. Targeted search for a separate analytics/AI add-on tier found no evidence one exists; the software license line appears to be genuinely all-inclusive.", checkedOn: "2026-07-27" },
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
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: [], reasoning: "Support bundled per reviews. Targeted search for a separate core-analytics add-on found nothing beyond the already-noted Safety Alert (weapon/fall detection) add-on, which is a feature beyond Verkada's baseline bundle, not a paid version of something Verkada gives away, so it isn't a parity gap and isn't added here.", checkedOn: "2026-07-27" },
    },
    notes: "Safety Alert (weapon detection) $419/yr add-on (reseller): a feature beyond baseline parity, not a bundled-elsewhere gap.",
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
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "high", sources: ["https://help.arcules.com/en/articles/9452081-forensic-video-search-by-motion-person-or-vehicle"], reasoning: "Arcules's own help center: \"There is no additional cost for forensic video search,\" with cloud-based object detection included at no charge on up to 20% of subscribed cameras (contact Arcules to raise that threshold). Directly confirms the Verkada-equivalent analytics feature is genuinely bundled, not a hidden gap.", checkedOn: "2026-07-27" },
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
      supportAddonPerCamYr: { value: 0, status: "estimated", confidence: "medium", sources: ["https://help.camio.com/hc/en-us/articles/205274239"], reasoning: "Base service includes people/vehicle/color/face-detection analytics and 30-day history, roughly matching Verkada's bundle. Advanced Object Labeling (AOL) is a confirmed real add-on ($1-89/stream/month), but it's a premium feature beyond Verkada's baseline (not a paid version of something Verkada bundles for free), highly usage-variable, and explicitly \"needed only on a portion of all cameras\" rather than a flat per-camera cost; too variable to responsibly assign a single number here.", checkedOn: "2026-07-27" },
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
    notes: "No NVR/DVR, no on-prem storage line; applianceCost left unset (n/a for the ripReplace path). Multi-year licensing saves up to ~30%, but that's a term discount, not negotiated off-list.",
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
      supportAddonPerCamYr: { value: 0, status: "sourced", confidence: "medium", sources: ["https://www.securitysales.com/surveillance/eagle-eye-smart-video-search-10th-anniversary/", "https://www.een.com/product/cloud-vms-subscriptions/"], reasoning: "24/7 operational monitoring, web/mobile, and alerts included in the per-camera subscription. Smart Video Search (the closest equivalent to Verkada's bundled people/vehicle search) confirmed as having no extra subscription fee. Object Counting and License Plate Recognition are separately noted as paid add-ons, but only a stale ~2018 legacy figure ($4-5/cam/mo) was found for either; too dated to use, and those are premium features beyond Verkada's baseline anyway, not a paid version of the bundled search itself.", checkedOn: "2026-07-27" },
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
      deviceLicense: { value: 150, status: "sourced", confidence: "high", sources: ["https://ipvm.com/reports/exacq-increases-enterprise-vms-pricing"], reasoning: "Professional $150/cam (Enterprise $225), confirmed directly.", checkedOn: "2026-07-26" },
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
    notes: "Software-only, camera-agnostic (ONVIF/RTSP). deviceLicense is peer-anchored to DW Spectrum, not directly quoted; spot-check before trusting it in isolation.",
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
    values: { deviceLicense: 30.6, carePct: 20 },
    fieldMeta: {
      deviceLicense: { value: 30.6, status: "sourced", confidence: "low", sources: ["https://jctnj.com/price-guide-download.php?id=22"], reasoning: "Ocularis Professional camera license (OC-PRO-1C) MSRP $30.60, from a 2022 Platinum Premier Partner price list, dated but a real line-item figure, not a guess. The higher Enterprise tier (OC-ENT-1C) appears to be discontinued per current reseller listings, so Professional is used as the current anchor.", checkedOn: "2026-07-27" },
      carePct: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "Enterprise VMS SMA ~20%/yr norm.", checkedOn: "2026-07-26" },
    },
    notes: "Ocularis (per-channel, edition-tiered) and VisionHub (enterprise/PSIM) are both quote-only. baseLicense still left unset (no reliable public $ found across two research passes). Hexagon-owned.",
  },
  "ISS (SecurOS)": {
    values: { deviceLicense: 66, baseLicense: 400, carePct: 20 },
    fieldMeta: {
      deviceLicense: { value: 66, status: "sourced", confidence: "medium", sources: ["https://www.a1securitycameras.com/iss-sox-cam-securos-xpress-camera-license.html"], reasoning: "SecurOS Xpress per-channel street price $66.18.", checkedOn: "2026-07-26" },
      baseLicense: { value: 400, status: "sourced", confidence: "low", sources: ["https://ipvm.com/reports/intelligent-security-systems-overview"], reasoning: "Xpress ~$400 base (IPVM report, dated ~2011, directional only, not current list.", checkedOn: "2026-07-26" },
      carePct: { value: 20, status: "estimated", confidence: "low", sources: [], reasoning: "SMA ~20%/yr; per-channel SMA ~$37 observed at reseller.", checkedOn: "2026-07-26" },
    },
    notes: "Base + per-channel, edition-tiered (Xpress/Pro/Enterprise). Pricing structure is dated (IPVM ~2011); spot-check before trusting.",
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
    notes: "Perpetual license + SUP model; Care Plus is effectively non-optional for Corporate. Device-license count follows Milestone's supported-hardware rules (multi-sensor/encoder devices can need more than one license). Analytics are largely partner/marketplace, not a single first-party SKU; left unset.",
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
    notes: "Enterprise tier assumed (right fit for a large fleet). Genetec also has a SaaS/hybrid path (Security Center SaaS: $149-199/cam/yr + Cloudlink appliances $1,395-4,630); that would be a separate cloud-side entry, not this on-prem one. Analytics are add-on/partner, left unset.",
  },
  "Avigilon Control Center (Motorola Solutions)": {
    values: { deviceLicense: 292, baseLicense: 0, carePct: 10, serverCost: 10155, serverCapacity: 76, storageCostPerTB: 30, raidLevel: "raid1", refreshCycleYears: 5 },
    fieldMeta: {
      deviceLicense: { value: 292, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "ACC7 Enterprise per-camera license MSRP; SLED/cooperative bid pricing seen as low as $212.70. Core tier (entry, 16-cam cap) runs ~$80/ch.", checkedOn: "2026-07-25" },
      baseLicense: { value: 0, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/", "https://ipvm.com/reports/avigilons-price-competitiveness"], reasoning: "ACC is licensed per camera channel; unlike Genetec/Milestone Corporate there's no separate base-license line.", checkedOn: "2026-07-25" },
      carePct: { value: 10, status: "sourced", confidence: "medium", sources: ["https://getsafeandsound.com/blog/avigilon-cost/"], reasoning: "Smart Assurance Plan runs $21-30/license/yr, ~10% of license. Historically Avigilon had no mandatory maintenance (IPVM 2011); SAP is now the common-but-optional upgrade path, so 10% is the realistic ongoing figure (0% if the customer forgoes upgrades).", checkedOn: "2026-07-25" },
      serverCost: { value: 10155, status: "sourced", confidence: "low", sources: ["https://www.ebay.de/itm/116441299996"], reasoning: "Avigilon HD NVR4X Standard, 48TB, 76-camera-licensed, seen at $10,155 on the secondary market. Avigilon does sell purpose-built NVR/HD appliances so this is a real anchor, but it's a used-market listing; verify against a current NVR SKU list before trusting closely.", checkedOn: "2026-07-25" },
      serverCapacity: { value: 76, status: "sourced", confidence: "low", sources: ["https://www.ebay.de/itm/116441299996"], reasoning: "That specific NVR4X unit was 76-camera-licensed; capacity varies by model/bitrate.", checkedOn: "2026-07-25" },
      storageCostPerTB: { value: 30, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; Avigilon NVRs bundle storage, so per-TB only matters if sizing separately.", checkedOn: "2026-07-25" },
      raidLevel: { value: "raid1", status: "estimated", confidence: "medium", sources: [], reasoning: "Default assumption; Avigilon NVRs ship RAID-configured.", checkedOn: "2026-07-25" },
      refreshCycleYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Typical.", checkedOn: "2026-07-25" },
    },
    notes: "Avigilon Alta is the cloud sibling ($179/1yr, $499/3yr, $799/5yr, $1,599/10yr per camera incl. 30-day storage; see CLOUD_VENDOR_DEFAULTS' \"Avigilon Alta (Motorola Solutions)\" entry, sourced separately). Analytics (Appearance Search, Unusual Activity Detection) are largely built into ACC Enterprise / self-learning cameras, not a separate SKU. SLED buyers save ~27-28% off MSRP via PEPPM/CMAS-type vehicles.",
  },
};

// ---------- ON-PREM CAMERA HARDWARE ----------
// Standardized to a consistent spec envelope (5MP, outdoor/exterior-rated,
// IP66/67+IK10, varifocal IR dome) wherever a vendor has one, rather than
// each vendor's easiest-to-find price regardless of resolution/rating/form
// factor. An earlier pass mixed indoor and outdoor models (Axis, Pelco,
// Hanwha were indoor-only against everyone else's outdoor rating), which
// understated those three vendors' real matched-spec cost. Where no clean
// outdoor 5MP sibling exists (Avigilon's is EOL and lacks IR, a real
// functional gap for a security camera, not just a paperwork difference),
// the prior anchor was kept rather than swap to a lesser-featured "match."
export const ONPREM_CAMERA_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  Hikvision: {
    values: { cameraCost: 364.87, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 364.87, status: "sourced", confidence: "medium", sources: ["https://www.compsource.com/buy/DS2CD2755FWDIZS/Hikvision-Usa-4273/5-MP-WDR-Varifocal-Network-Dome-Camera-DS2CD2755FWDIZS/3241"], reasoning: "DS-2CD2755FWD-IZS (5MP WDR varifocal outdoor dome) $364.87, confirmed directly (a second reseller showed $376.64, same ballpark). EOL and NDAA-banned: Hikvision has no current, non-banned 5MP outdoor varifocal dome sold new in the US; this is the closest real price point for the matched spec.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Hikvision US warranty commonly 3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: DS-2CD2755FWD-IZS (5MP outdoor). NDAA-restricted (US federal) and this specific SKU is EOL; treat as a historical price point, not a current quote.",
  },
  "Dahua Technology": {
    values: { cameraCost: 164, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 164, status: "sourced", confidence: "high", sources: ["https://www.cctv-mall.com/products/dahua_ipc-hdbw3541r-zas-s2_5mp_ir_vari-focal_dome_wizsense_network_camera"], reasoning: "IPC-HDBW3541R-ZAS-S2 (5MP IR varifocal outdoor WizSense dome) $164.00, confirmed directly (variant -ZS-S2 seen at $156, same family). EOL and NDAA-banned, same caveat as Hikvision.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Dahua standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: IPC-HDBW3541R-ZAS-S2 (5MP outdoor). NDAA-restricted; this SKU is EOL, treat as a historical price point.",
  },
  Uniview: {
    values: { cameraCost: 529, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 529, status: "sourced", confidence: "medium", sources: ["https://www.tritekelectronics.com/uncategorized-products/2024-03-28-02-18-58701418312"], reasoning: "IPC3535SR4-ADZK-H (5MP outdoor varifocal dome) $529.00. Not independently re-verified beyond this single reseller listing.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Uniview standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: IPC3535SR4-ADZK-H (5MP outdoor, NDAA-compliant, unlike Hikvision/Dahua, still current for US federal/education buyers).",
  },
  "Bosch Security": {
    values: { cameraCost: 562, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 562, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1363699-REG/bosch_nde_5503_al_flexidome_ip_outdoor_5000i.html"], reasoning: "FLEXIDOME IP outdoor 5000i (NDE-5503-AL, 5MP, IP66/IK10) $562.49 street at B&H; MSRP ~$1,027-1,108 depending on source.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Bosch standard 3-yr (extendable).", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: NDE-5503-AL (already the outdoor-rated spec, no change needed here). Built-in Essential Video Analytics. Large list-to-street gap.",
  },
  "i-PRO (ex-Panasonic)": {
    values: { cameraCost: 839.95, warrantyYears: 5 },
    fieldMeta: {
      cameraCost: { value: 839.95, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1719263-REG/i_pro_s_series_wv_s25500_v3ln_5mp_outdoor.html"], reasoning: "WV-S25500-V3LN (5MP outdoor, current S-Series successor to the discontinued WV-S2250L/WV-S2252L) $839.95, confirmed directly at B&H. Replaces the prior estimate on a doubly-discontinued model with a real current-generation price.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 5, status: "sourced", confidence: "medium", sources: ["https://cookandboardman.com/i-pro-extreme-wv-s2250l-5-mp-dome-network-camera-discontinued/"], reasoning: "5-year limited warranty on the prior-generation spec; carried forward as the vendor's standard program, not re-confirmed for this exact SKU.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: WV-S25500-V3LN (5MP outdoor, current). Premium-priced vs. Asian OEMs, consistent with i-PRO's market position.",
  },
  Vivotek: {
    values: { cameraCost: 329.64, warrantyYears: 5 },
    fieldMeta: {
      cameraCost: { value: 329.64, status: "sourced", confidence: "high", sources: ["https://www.connection.com/product/vivotek-5mp-outdoor-network-dome-camera-with-2.8-12mm-lens/fd9388-htv/38345303"], reasoning: "FD9388-HTV (5MP outdoor network dome, 2.8-12mm) $329.64, confirmed directly, upgrading the prior sibling-extrapolated estimate (~$300) to a real quoted price for the same SKU.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 5, status: "estimated", confidence: "low", sources: [], reasoning: "Vivotek pro cameras 3-5yr; upper bound used.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: FD9388-HTV (5MP outdoor, already the right spec, now sourced directly instead of estimated).",
  },
  Pelco: {
    values: { cameraCost: 660.7, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 660.7, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1963950-REG/pelco_sarix_pro_4_series.html"], reasoning: "Switched from the indoor SRXP4-5V10-IMD-IR to its outdoor sibling SRXP4-5V10-EMD-IR (5MP, IP67/NEMA4X/IK10): same family, same resolution, IR, and lens (3.4-10.5mm), confirmed directly at $660.70 (street as low as $504-534 at other resellers).", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Pelco standard ~3-yr.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: SRXP4-5V10-EMD-IR (5MP outdoor; was priced via the indoor -IMD-IR sibling before). Motorola/Pelco channel.",
  },
  Honeywell: {
    values: { cameraCost: 503.5, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 503.5, status: "sourced", confidence: "high", sources: ["https://www.bhphotovideo.com/c/product/1524634-REG/honeywell_hc30we5r2_5mp_wdr_ir_ip.html"], reasoning: "HC30WE5R2 (5MP WDR IR outdoor) $503.50, confirmed directly for the exact SKU, replacing the prior estimate that had anchored this same model off an unconfirmed bullet sibling's price ($760).", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Honeywell standard multi-year.", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: 30 Series HC30WE5R2 (5MP outdoor). Correction: this is a turret/\"ball\" form factor, not a dome as previously described. NDAA-compliant.",
  },
  "Avigilon (Cameras)": {
    values: { cameraCost: 850, warrantyYears: 3 },
    fieldMeta: {
      cameraCost: { value: 850, status: "estimated", confidence: "low", sources: ["https://www.newegg.com"], reasoning: "Exact 5.0 H5A dome is quote-only; nearest published anchors are the value-line 5MP H5SL dome (5.0C-H5SL-DO1-IR, confirmed $579 on Newegg, has IR) and the 6MP H5A ($879, has IR); mid estimate ~$850 for the analytics-heavy H5A. A cheaper 5MP H5A-DO2 anchor exists (~$650 est., extrapolated from a $656.56 4MP sibling) but that line is EOL and lacks IR entirely (a real functional gap for an outdoor security camera, not just a paperwork difference), so the IR-equipped H5SL/H5A anchor was kept instead of chasing the lower number.", checkedOn: "2026-07-26" },
      warrantyYears: { value: 3, status: "estimated", confidence: "medium", sources: [], reasoning: "Avigilon standard ~3-yr (extendable).", checkedOn: "2026-07-26" },
    },
    notes: "Priced model: H5A dome (5.0C-H5A-DO1-IR, 5MP outdoor, IR). Distinct from Avigilon Control Center VMS; this is the camera-hardware brand. H5A is the premium analytics line; H5SL is the value line ($579, confirmed). SPOT-CHECK cameraCost before trusting; still an estimate.",
  },
  "Axis Communications": {
    values: { cameraCost: 999, warrantyYears: 3, fleetHalfLifeYears: 12 },
    fieldMeta: {
      cameraCost: { value: 999, status: "sourced", confidence: "high", sources: ["https://www.surveillance-video.com/camera-02330-001.html", "https://www.cdwg.com/product/axis-p3267-lve-repl-5mp-network-camera/6906306"], reasoning: "Switched from the indoor P3267-LV to its outdoor sibling P3267-LVE (same 5MP sensor, ARTPEC-8, varifocal lens, IP66/IK10 outdoor housing): same family, only the environmental rating differs. Confirmed directly at $999.00.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 3, status: "sourced", confidence: "medium", sources: ["https://www.axis.com/products/axis-p3265-lv/support"], reasoning: "Axis standard hardware warranty is 3 years, extendable to 5 via registration/extension. Changes when replacement cost (vs. labor-only) kicks in; spot-check whether 3 or 5 fits the deal.", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 12, status: "estimated", confidence: "low", sources: [], reasoning: "Axis's reliability reputation supports a longer-than-generic half-life; anchored above the 10 used elsewhere, not sourced.", checkedOn: "2026-07-25" },
    },
    notes: "Priced model: AXIS P3267-LVE (5MP outdoor; was priced via the indoor P3267-LV before). P3267-LV/-LVE is being phased out by Axis, a current-gen equivalent may reprice.",
  },
  "Hanwha Vision": {
    values: { cameraCost: 1103.76, warrantyYears: 5, fleetHalfLifeYears: 10 },
    fieldMeta: {
      cameraCost: { value: 1103.76, status: "sourced", confidence: "high", sources: ["https://www.a1securitycameras.com/samsung-xnv-8080r-5mp-vandal-ir-dome-ip-security-camera.html"], reasoning: "Switched from the indoor XND-8080RV to its outdoor counterpart XNV-8080R (5MP, same Wisenet-5 generation and \"8080\" line, vandal-resistant outdoor dome), confirmed directly at $1,103.76.", checkedOn: "2026-07-27" },
      warrantyYears: { value: 5, status: "estimated", confidence: "medium", sources: [], reasoning: "Hanwha's North America Wisenet warranty program is commonly 5 years; one reseller listing for the indoor sibling showed 3yr instead; unresolved discrepancy, confirm against current terms for the target region.", checkedOn: "2026-07-25" },
      fleetHalfLifeYears: { value: 10, status: "estimated", confidence: "low", sources: [], reasoning: "Generic; roughly on par with commodity-premium IP domes.", checkedOn: "2026-07-25" },
    },
    notes: "Priced model: XNV-8080R (5MP outdoor; was priced via the indoor XND-8080RV before). Distinct from the \"Hanwha Wisenet WAVE\" entry in ONPREM_VMS_VENDOR_DEFAULTS: that's the VMS software, this is the camera-hardware brand. Country of origin listed as China for this model, which matters for NDAA/procurement filtering in some federal/education contexts even though Hanwha itself is South Korean.",
  },
};
