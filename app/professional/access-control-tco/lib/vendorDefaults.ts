// Per-vendor researched defaults, keyed by the exact names in providers.ts.
// Produced from RESEARCH_PROMPT.md on 2026-10-27 and reviewed before merging
// on 2026-11-12. Verkada's license prices, free Bluetooth unlock, lack of
// Mercury panel support, and 10-year warranty were confirmed by a reviewer
// with access to Verkada's own sources; fields confirmed that way but with no
// public URL stay "estimated" (high confidence), since "sourced" means a
// citable page.
//
// Most vendors only have a panel-compatibility entry: their license pricing
// is quote-only, and the secondary figures found were mostly competitors'
// own blogs that disagreed by several times, so none was used. Their picker
// badge says "Price not researched, using generic default", which is the
// honest state. Not researched at all: Honeywell Pro-Watch, Identiv Hirsch
// Velocity, LenelS2 NetBox. Deliberately never set from vendor research:
// staff time, labor, door hardware, discount, servers, and card prices (see
// the prompt's section 2).
import type { SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";
import {
  confidenceSummary as sharedConfidenceSummary, fieldSourceInfo as sharedFieldSourceInfo, switchVendor as sharedSwitchVendor,
  type ConfidenceSummary, type FieldMeta, type VendorDefaultEntry as SharedVendorDefaultEntry,
} from "../../_tco-shared/lib/vendorData";

export type VendorDefaultEntry = SharedVendorDefaultEntry<SolutionInputs>;

// One field's provenance. `sourced` needs at least one URL; `estimated`
// needs its reasoning.
const sourced = (value: unknown, confidence: FieldMeta["confidence"], sources: string[], reasoning?: string, checkedOn = "2026-10-27"): FieldMeta =>
  ({ value, status: "sourced", confidence, sources, reasoning, checkedOn });
const estimated = (value: unknown, confidence: FieldMeta["confidence"], reasoning: string, sources: string[] = [], checkedOn = "2026-10-27"): FieldMeta =>
  ({ value, status: "estimated", confidence, sources, reasoning, checkedOn });

const VERKADA_PRICING = "https://www.verkada.com/pricing/";
const VERKADA_DATASHEET = "https://cssi.com/wp-content/uploads/cssi_Verkada_Access_Control_Datasheet.pdf";
const RHOMBUS_PRICING = "https://rhombus.com/pricing/access-control/";
const KISI_PRICING = "https://www.getkisi.com/pricing";
const KISI_OVERVIEW = "https://pages.getkisi.com/hubfs/kisi-pricing-overview.pdf";
const ONGUARD_PRICEBOOK = "https://osp.admin.mn.gov/sites/osp/files/2024-06/s-8135_184435_lenelonguardecosystem_msrp_pricebook_eff1124.pdf";
const CCURE_PRICELIST = "https://osp.admin.mn.gov/sites/osp/files/2023-04/s-8135softwarehouse_msrp10.2022.pdf";
const PAXTON_PRICES = "https://www.paxton-access.com/ae/install-paxton/resources/product-price-changes-2022";
const PAXTON_IPVM = "https://ipvm.com/reports/paxton-access-control-company-profile";

// ---------- CLOUD ----------
export const CLOUD_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  Verkada: {
    values: {
      tierPrice: 249, tierYears: 1, controllerCost: 1999, doorsPerController: 4, readerCost: 349, warrantyYears: 10,
      mobileCostPerUserYr: 0, reusesReaders: true, reusesControllers: false,
    },
    fieldMeta: {
      tierPrice: sourced(249, "high", [VERKADA_DATASHEET], "LIC-AC-1Y, per door, 1-year term. Also 3yr $599, 5yr $999, 10yr $1,999 per door. From an AC41-generation datasheet (the current pricing page didn't expose license rows); confirmed current by the reviewer.", "2026-11-12"),
      tierYears: sourced(1, "high", [VERKADA_DATASHEET], "Shortest term sold; 3, 5, and 10-year terms are cheaper per year.", "2026-11-12"),
      controllerCost: sourced(1999, "high", [VERKADA_PRICING], "AC43 4-door controller, US MSRP. Door licenses are separate and per door in use: an AC43 running four doors needs four, running two needs two (confirmed by the reviewer). The 16-door AC62 is $5,999."),
      doorsPerController: sourced(4, "high", [VERKADA_PRICING], "AC43."),
      readerCost: sourced(349, "high", [VERKADA_PRICING], "AD34 door reader, US MSRP."),
      warrantyYears: sourced(10, "high", [VERKADA_DATASHEET], "\"All Verkada hardware purchases are backed by our 10-year limited warranty\"; confirmed by the reviewer for access control hardware.", "2026-11-12"),
      mobileCostPerUserYr: estimated(0, "high", "Bluetooth unlock in the Verkada Pass app carries no per-user fee (confirmed by the reviewer; no public page states it). NFC wallet credentials are an optional extra at $199 per 20 users per year ($9.95/user/yr) on the pricing page.", [VERKADA_PRICING], "2026-11-12"),
      reusesReaders: sourced(true, "high", ["https://help.verkada.com/access-control/installation/badge-reader-support"], "Third-party OSDP readers over RS-485 and Wiegand readers on the Wiegand ports; HID Signo and R series verified."),
      reusesControllers: estimated(false, "high", "Verkada controllers can't take over existing Mercury panels (confirmed by the reviewer); Verkada documents only its own controllers.", ["https://www.k12mt.com/hubfs/K12Montana-and-VERKADA-access-control-overview.pdf"], "2026-11-12"),
    },
    notes: "Encrypted cards are $799 per 100 (not set; card price stays generic).",
  },
  Rhombus: {
    values: { tierPrice: 199, tierYears: 1, controllerCost: 1399, doorsPerController: 4, readerCost: 299, warrantyYears: 10, reusesReaders: true, reusesControllers: false },
    fieldMeta: {
      tierPrice: sourced(199, "high", [RHOMBUS_PRICING, "https://cdwg.com/product/rhombus-5-year-access-control-door-license/7450577"], "Per door, 1-year term, US MSRP. 1, 3, 5, and 10-year terms offered; the 5-year is $680.29 at CDW-G."),
      tierYears: sourced(1, "high", [RHOMBUS_PRICING]),
      controllerCost: sourced(1399, "high", [RHOMBUS_PRICING], "DC20 4-door controller, US MSRP."),
      doorsPerController: sourced(4, "high", [RHOMBUS_PRICING], "DC20, 4 doors maximum."),
      readerCost: sourced(299, "high", [RHOMBUS_PRICING], "DR20 door reader, US MSRP."),
      warrantyYears: sourced(10, "high", ["https://rhombus.com/access-control/door-controllers/dc20/"], "10-year warranty on the DC20."),
      reusesReaders: sourced(true, "high", ["https://support.rhombussystems.com/hc/en-us/articles/18746736668173-Wiegand-vs-OSDP"], "DC20 supports third-party Wiegand and certified OSDP readers."),
      reusesControllers: estimated(false, "medium", "Door licenses require Rhombus DC10/DC20 controllers; no third-party panel support found.", [RHOMBUS_PRICING]),
    },
  },
  Kisi: {
    values: { controllerCost: 850, doorsPerController: 4, readerCost: 475, warrantyYears: 5, reusesReaders: true },
    fieldMeta: {
      controllerCost: sourced(850, "high", [KISI_PRICING], "Controller Pro 2 (a 2023 sheet listed $1,099)."),
      doorsPerController: sourced(4, "high", [KISI_OVERVIEW], "Controller Pro 2 connects up to 4 doors."),
      readerCost: sourced(475, "high", [KISI_PRICING], "Reader Pro 2."),
      warrantyYears: sourced(5, "high", [KISI_PRICING], "Pricing FAQ: 5-year warranty on hardware."),
      reusesReaders: sourced(true, "high", [KISI_OVERVIEW], "Wiegand board connects up to 4 Wiegand readers to a Controller Pro 2."),
    },
    notes: "Door license price not set: a 2023 sheet shows tiers \"starting at\" $199 (Standard, up to 250 users), $299 (Pro), and $449 (Pro+) with the billing unit unclear, and a reseller's bundles work out to $210-270 per door.",
  },
  Brivo: {
    values: { reusesControllers: true },
    fieldMeta: {
      reusesControllers: sourced(true, "high", ["https://resources.brivo.com/data-sheets/mercury-solutions-data-sheet"], "Mercury LP1501/LP1502/LP2500 and MP series convert to Brivo with its provisioning tool. EP series support ended March 2026."),
    },
    notes: "License price is quote-only. An installer's guide reports a base fee plus $6.20-18.50 per reader per month; not used.",
  },
  "Avigilon Alta (Motorola Solutions)": {
    values: { reusesControllers: true },
    fieldMeta: {
      reusesControllers: sourced(true, "medium", ["https://www.avigilon.com/fs/documents/avigilon-alta-access-administrator-guide-en.pdf", "https://www.avigilon.com/fs/documents/avigilon-access-control-core-datasheet.pdf"], "Mercury MP series support added November 2024; the core datasheet also lists LP series. No full model and firmware matrix found."),
    },
    notes: "License price is quote-only; secondary estimates range from $899 to $2,800 per door per year. Not used.",
  },
  Genea: {
    values: { reusesControllers: true },
    fieldMeta: {
      reusesControllers: sourced(true, "medium", ["https://www.getgenea.com/blog/genea-access-control-partners-with-mercury-security-hardware/"], "Mercury Authentic Partner."),
    },
    notes: "License price is quote-only.",
  },
  "Feenics (Acre Security)": {
    values: { reusesControllers: true },
    fieldMeta: {
      reusesControllers: sourced(true, "medium", ["https://www.securityinfowatch.com/access-identity/press-release/12296915/industrys-most-secure-on-premise-or-cloudhosted-integrated-access-control-and-security-management-solutions-feenics-rises-to-platinum-partner-status-with-mercury-security"], "Mercury Platinum Partner."),
    },
    notes: "Now sold as acre Access Control. License price not found; an undated \"$25/door hosted MSRP\" appears only on a competitor's review page.",
  },
};

// ---------- SERVER-BASED ----------
export const ONPREM_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {
  "LenelS2 OnGuard": {
    values: { baseLicense: 3760, doorLicense: 0, controllerCost: 2612, doorsPerController: 2, readerCost: 325, reusesReaders: true, reusesControllers: true },
    fieldMeta: {
      baseLicense: sourced(3760, "high", [ONGUARD_PRICEBOOK], "SWS-ADV server license, MSRP effective 2024-01-01: up to 64 card readers and the first year's support plan."),
      doorLicense: sourced(0, "high", [ONGUARD_PRICEBOOK], "Readers up to 64 are included in the ADV license; beyond that needs reader capacity upgrades (ADV goes to 256)."),
      controllerCost: sourced(2612, "high", [ONGUARD_PRICEBOOK], "LNL-X2220 dual-reader controller, two doors."),
      doorsPerController: sourced(2, "high", [ONGUARD_PRICEBOOK], "LNL-X2220 on-board two-door control."),
      readerCost: sourced(325, "high", [ONGUARD_PRICEBOOK], "HID Signo 40 wall mount (40NKS-01-000000)."),
      reusesReaders: sourced(true, "high", [ONGUARD_PRICEBOOK], "LNL-X2220 supports OSDP (Secure Channel) and Wiegand readers."),
      reusesControllers: sourced(true, "medium", [ONGUARD_PRICEBOOK], "OnGuard's LNL controller boards are Mercury hardware (the price book's changes list \"price increases on Mercury hardware\"), so existing Lenel/Mercury panels carry over."),
    },
    notes: "Support plan (SUSP) pricing is quote-only even in the MSRP book; carePct stays generic. SQL Server (S00300-DVD) is $1,015, not set. The no-per-door license holds only up to 64 readers.",
  },
  "Software House C•CURE 9000": {
    values: { baseLicense: 5905, doorLicense: 0, carePct: 26, controllerCost: 1855, doorsPerController: 8 },
    fieldMeta: {
      baseLicense: sourced(5905, "high", [CCURE_PRICELIST], "CC9000-SN Series N system license, 64 readers and 40,000 cardholders, MSRP October 2022. Other tiers: L 16 readers $1,345, M 32 $2,560, P 128 $10,220."),
      doorLicense: sourced(0, "high", [CCURE_PRICELIST], "Licensed by reader-count tier, not per door."),
      carePct: sourced(26, "high", [CCURE_PRICELIST], "CC9000-NSSA1 Standard SSA for Series N, $1,540/yr = 26.1% of the $5,905 license."),
      controllerCost: sourced(1855, "medium", [CCURE_PRICELIST], "USTAR-LT08-MB iSTAR Ultra LT main board, 8 readers. Board only; enclosure and power supply are extra."),
      doorsPerController: sourced(8, "medium", [CCURE_PRICELIST], "8 readers, so 8 doors at one reader per door (4 with in/out readers)."),
    },
    notes: "Mercury panel support appears only on a dealer's marketing page, so reusesControllers stays at the default. The tier figures hold only for 33-64 readers.",
  },
  "Genetec Security Center (Synergis)": {
    values: { doorLicense: 175, reusesControllers: true },
    fieldMeta: {
      doorLicense: sourced(175, "low", ["https://ipvm.com/reports/genetec-access-control-company-profile"], "IPVM company profile (undated): an additional single-door license is about $175."),
      reusesControllers: sourced(true, "high", ["https://genetec.com/binaries/content/assets/genetec-pt/brochure/brochureproduct_pt_synergis-hardware_web.pdf"], "Supports Mercury LP and EP panels, Axis A1601, and HID controllers, some through a Synergis Cloud Link appliance."),
    },
    notes: "Base license not found. Maintenance is about $500 per server plus $10-15 per reader per year (same IPVM profile), which a percentage can't express; carePct stays generic.",
  },
  "Paxton Net2": {
    values: { baseLicense: 715.22, doorLicense: 0, carePct: 0, controllerCost: 650.74, doorsPerController: 1, reusesControllers: false },
    fieldMeta: {
      baseLicense: sourced(715.22, "high", [PAXTON_PRICES], "Net2 Pro software (930-010-EX), US RRP effective 2022-01-04. Net2 Lite is free with fewer features."),
      doorLicense: sourced(0, "high", [PAXTON_IPVM], "\"No licensing for adding doors.\""),
      carePct: sourced(0, "medium", [PAXTON_IPVM], "\"No ongoing maintenance or upgrade fees.\""),
      controllerCost: sourced(650.74, "high", [PAXTON_PRICES], "Net2 Plus 1-door controller, 12V PSU, metal cabinet (682-813-EX), US RRP effective 2022-01-04."),
      doorsPerController: sourced(1, "high", [PAXTON_PRICES], "1-door controller."),
      reusesControllers: estimated(false, "medium", "Net2 runs on Paxton's own Net2 Plus controllers."),
    },
    notes: "Prices are from January 2022 and likely higher now.",
  },
  "Avigilon Unity Access": {
    values: { reusesControllers: true },
    fieldMeta: {
      reusesControllers: sourced(true, "high", ["https://www.avigilon.com/mercury-access-control-review"], "Avigilon is a Platinum Elite Mercury partner and lists Unity as an approved Mercury OEM software."),
    },
    notes: "License price is quote-only.",
  },
  "AMAG Symmetry": {
    values: { reusesControllers: false },
    fieldMeta: {
      reusesControllers: estimated(false, "low", "Uses AMAG's own controllers (multiNODE, M4000); an IPVM discussion describes proprietary boards. No Mercury support found.", ["https://ipvm.com/discussions/4980"]),
    },
    notes: "License price is quote-only.",
  },
  "Gallagher Command Centre": {
    values: { reusesControllers: false },
    fieldMeta: {
      reusesControllers: estimated(false, "low", "Gallagher documents only its own Controller 6000/7000; no third-party panel support found.", ["https://security.gallagher.com/en/Solutions/Controllers"]),
    },
    notes: "License price is quote-only.",
  },
};

// Researched licenses that are priced by reader-count tier, so the
// researched figure only holds up to this many readers. The checklist warns
// when a comparison goes past it with the researched price still in place.
export const LICENSE_READER_LIMITS: Record<string, { readers: number; baseLicense: number }> = {
  "LenelS2 OnGuard": { readers: 64, baseLicense: 3760 },
  "Software House C•CURE 9000": { readers: 64, baseLicense: 5905 },
};

export const vendorTableFor = (model: SolutionInputs["model"]) => (model === "cloud" ? CLOUD_VENDOR_DEFAULTS : ONPREM_VENDOR_DEFAULTS);

export function vendorEntriesFor(sol: SolutionInputs): (VendorDefaultEntry | undefined)[] {
  return [vendorTableFor(sol.model)[sol.name]];
}

// What the provider picker calls when the vendor changes (see the shared
// switchVendor).
export function switchVendor(sol: SolutionInputs, prevVendor: string | undefined, nextVendor: string): SolutionInputs {
  return sharedSwitchVendor(sol, prevVendor, nextVendor, vendorTableFor(sol.model), defaultSolution(sol.id, sol.name, sol.model));
}

export function fieldSourceInfo(sol: SolutionInputs, key: keyof SolutionInputs): FieldMeta | null {
  return sharedFieldSourceInfo(key, sol[key], vendorEntriesFor(sol));
}

export function confidenceSummary(sol: SolutionInputs): ConfidenceSummary {
  return sharedConfidenceSummary(sol.name, vendorTableFor(sol.model), sol.model === "cloud" ? "tierPrice" : "doorLicense");
}
