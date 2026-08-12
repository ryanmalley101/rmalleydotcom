# Research prompt: per-vendor TCO defaults

Hand the prompt below (everything after the `---`) to a Claude session that
has web search/browsing available. It's self-contained: the `SolutionInputs`
type is pasted in full (with its explanatory comments, since several fields
are ambiguous without them), so the runner doesn't need access to this repo
or any prior conversation context.

**Why this exists:** `app/professional/tco-calculator/lib/defaults.ts`
currently gives every cloud provider the same numeric defaults (in practice,
one specific vendor's real published pricing) and every on-prem VMS+camera
pairing the same numeric defaults (one specific pairing's real pricing).
Picking a different provider from the dropdown changes the *name* shown but
not the *numbers* until a user manually edits them. See
`app/professional/tco-calculator/README.md`'s "Known softball risks"
section for the full writeup of why that's a problem worth fixing, and
`git log --oneline -- app/professional/tco-calculator` for how those
defaults got there (they're inherited from an earlier single-vendor tool,
not independently researched per competitor).

**What "done" looks like:** a new `lib/vendorDefaults.ts` exporting a
lookup table keyed by provider name, each entry holding both the plain
`Partial<SolutionInputs>` values and a parallel per-field provenance map
(source URL(s), sourced-vs-estimated, confidence, date checked), wired into
the wizard's provider `Select`s so picking a known vendor also seeds its own
numbers (falling through to today's generic defaults for "Other" or any
vendor without researched data yet). The prompt below produces a richer,
per-field-sourced research artifact than that final shape strictly needs
(one flat source list per vendor would technically suffice) — that's
deliberate, since collapsing multiple fields down to one shared source list
loses which source backs which number. Expect a reshaping pass at merge
time, not a direct paste-in.

Review the output before merging it. Treat "estimated" entries as a first
draft, not a citation, they're explicitly not sourced.

---

## Prompt

You are populating vendor defaults for a physical-security TCO calculator.
Your output will be reviewed by a human and, if approved, merged into a new
`lib/vendorDefaults.ts`. **Do not write, edit, or attempt to merge any
file.** Produce a structured research artifact only.

Web search is required. Accuracy and honest provenance matter more than
completeness. A well-labeled gap is more useful than a confident guess.

---

### 1. The type you are filling

This is the actual `SolutionInputs` type from the calculator (plus the
smaller types it references), copied verbatim including its comments —
several fields are ambiguous without them (e.g. whether a price is a
one-time cost or annual, per-camera or per-appliance). Do not invent field
names beyond what's shown here, and do not fill in `ScenarioInputs` fields
(`adminRate`, `investigatorRate`, `truckRollCost`,
`cameras`, `sites`, etc.) — those are the *operator's own* shared market
rates, not vendor-specific, and are out of scope for this research.

```ts
export type DeploymentModel = "cloud" | "onprem";
export type IncumbentChoice = "none" | "a" | "b";
// How a cloud/hybrid solution's cameras get onto the new platform:
// "connector" reuses the existing camera fleet behind a connector/NVR-style
// appliance (a common product shape among cloud/hybrid VMS vendors) - year-0
// hardware cost is just that appliance, and cameras are swapped for native
// ones only as they fail, same as the ongoing replacement schedule.
// "ripReplace" swaps every camera for a native one up front - year-0 cost is
// the full fleet of native cameras instead, and no connector appliance.
export type CloudMigrationStrategy = "connector" | "ripReplace";

// On-prem storage redundancy. Affects only how much *raw* storage has to be
// bought to get the fleet's usable/needed TB, not the recording server count.
export type RaidLevel = "none" | "raid0" | "raid1" | "raid10";
// Raw-storage multiplier needed to get one TB of usable capacity. RAID 0 and
// no RAID both need exactly the usable capacity (no redundancy overhead);
// RAID 1 and RAID 10 both mirror everything, doubling the raw capacity
// needed to survive a drive failure.
// (RAID_STORAGE_MULTIPLIER: none/raid0 = 1x, raid1/raid10 = 2x raw capacity)

export interface ScenarioInputs {
  cameras: number;
  sites: number;
  retentionDays: number;
  horizonYears: number;
  bitrateMbps: number;
  investigationsPerMonth: number;
  annualEscalationPct: number;
  incumbent: IncumbentChoice;
  // Shared market rates: the operator's own costs, independent of vendor.
  // OUT OF SCOPE for this research pass — do not fill these in.
  adminRate: number;
  investigatorRate: number;
  truckRollCost: number;
}

export interface SolutionInputs {
  id: "a" | "b";
  name: string;
  model: DeploymentModel;
  // On-prem deployments typically pair a VMS vendor with a separate camera
  // hardware vendor; cloud/hybrid deployments are usually a single ecosystem,
  // so cloud solutions just use `name` directly. Bookkeeping only: the calc
  // engine never reads these, they only drive the wizard's naming UI.
  vmsProvider?: string;
  cameraProvider?: string;
  discountPct: number; // off list, this vendor's own negotiated discount

  // Shared across both models
  cameraCost: number; // $/cam, replacement hardware
  // Bulk professional install (year-0 buildout, planned rollout across the
  // whole fleet) is typically cheaper per camera than an unplanned one-off
  // truck roll to swap a single failed unit later, hence two separate rates.
  bulkInstallLaborCost: number; // $/cam, year-0 buildout only
  replacementInstallLaborCost: number; // $/cam, ongoing decay-driven swaps
  // How long until roughly half of today's cameras have failed and been
  // replaced. Per-solution (not shared) since each side's camera hardware
  // can have a different reliability curve, even when comparing two
  // deployments of the same type (e.g. two different on-prem camera brands).
  fleetHalfLifeYears: number;
  // How many years new camera hardware is covered by the manufacturer's
  // warranty. A failure within this window is assumed to cost only the labor
  // to swap the unit, not the hardware itself, so the half-life-driven
  // replacement cost is moot until a camera outlives its warranty.
  warrantyYears: number;
  truckRollsPerSiteYr: number; // vendor-driven reliability, not the $/truck-roll rate itself
  adminHrsPerCamYr: number; // hours, not dollars — how hands-on this vendor's platform is to run
  investigationHrsPerIncident: number; // hours to pull/review footage for one incident, this vendor's UX
  // Frames per second per camera. Per-solution since each side's cameras can
  // run at a different rate; scales on-prem storage sizing relative to the
  // 24fps baseline (bitrate is already a full encoded rate, so this is a
  // secondary adjustment on top of it, not a replacement for it).
  framerateFps: number;

  // Cloud/hybrid only
  migrationStrategy: CloudMigrationStrategy; // "connector" is the more common product shape; use it as the default assumption unless the vendor is software-only/camera-agnostic
  tierPrice: number; // license cost for a term of `tierYears`, this vendor's own term length ($/cam for the whole term, not annualized)
  tierYears: number; // the term length tierPrice is quoted for (e.g. 1, 3, 5)
  applianceCost: number; // connector/NVR-style appliance, $/unit, only applicable when migrationStrategy is "connector"; n/a if the vendor has no such product
  applianceCapacity: number; // camera streams supported per appliance unit
  applianceRefreshCycleYears: number; // how often the appliance itself is refreshed, if documented; otherwise a reasonable estimate
  yearsUntilNextApplianceRefresh: number; // leave as an estimate/placeholder (e.g. half the refresh cycle) — this is deployment-specific, not vendor-specific; low priority to source
  // Defaults to 0 ("bundled into the license"). Not every cloud vendor bundles
  // support/analytics/extended retention into one flat price the way this
  // tool's own defaults assume; this makes that assumption visible and
  // overridable per solution instead of a silent, hardcoded universal.
  supportAddonPerCamYr: number; // $/cam/yr, 0 if genuinely bundled into the base license

  // On-prem only
  baseLicense: number; // one-time base/server license cost, if published separately from per-device pricing
  deviceLicense: number; // $/cam, one-time, perpetual license
  carePct: number; // annual support/maintenance renewal, as % of license cost/yr
  serverCost: number; // recording server hardware, $/unit — only if the vendor sells/recommends specific server hardware; otherwise estimate against generic server pricing and say so
  serverCapacity: number; // cameras supported per recording server
  storageCostPerTB: number; // $/TB usable — this is a generic storage-market number, not really vendor-specific; low priority to source per vendor, generic estimate is fine
  raidLevel: RaidLevel; // the vendor's recommended/default redundancy level, if documented; otherwise "raid1" is a reasonable default assumption
  analyticsApplianceCost: number; // separate analytics appliance, $, if sold as a distinct hardware add-on
  analyticsSoftwareCost: number; // separate analytics software module, $/yr, if sold separately from the base VMS
  refreshCycleYears: number; // typical/recommended hardware refresh cadence, if documented
  yearsUntilNextRefresh: number; // leave as an estimate/placeholder — deployment-specific, not vendor-specific; low priority to source
}
```

If a field's meaning is still ambiguous once you've read the comments above
(unit basis, one-time vs. recurring, per-camera vs. per-channel vs.
per-site), state your interpretation in that field's `reasoning` rather than
guessing silently.

---

### 2. Scope: three categories, ~10 vendors each

Research roughly ten vendors per category. The lists below are starting
points, not a fixed roster. Add, drop, or swap based on market relevance,
and note any change.

**A. Cloud / hybrid VMS** (subscription, usually per-camera-per-year; often
bundled appliance + license)
Candidates: Rhombus, Eagle Eye Networks, Cisco Meraki, Avigilon Alta
(Motorola/Ava), Spot AI, Coram, Camio, Turing, Solink, Arcules, Verkada.

**B. On-prem VMS software** (perpetual license per channel + annual
maintenance/SUP, or subscription)
Candidates: Milestone XProtect, Genetec Security Center, Avigilon ACC,
Exacq / exacqVision (Tyco), Digital Watchdog, Network Optix (Nx Witness),
Hanwha Wisenet WAVE, Qognify, ISS, 3xLOGIC, BriefCam.

**C. On-prem camera hardware** (per-unit device cost; note resolution tier
/ form factor)
Candidates: Axis, Hanwha (Wisenet), Bosch, i-PRO (ex-Panasonic), Vivotek,
Pelco, Hikvision, Dahua, Uniview, Honeywell, Avigilon.

For cameras, do not price "the vendor" as one number. Anchor to a
representative mid-tier fixed dome or bullet (roughly 4–5MP, indoor/outdoor)
and name the specific model you priced.

---

### 3. Sourcing rules (non-negotiable)

- **Every value presented as real requires a source URL.** No URL means it
  cannot be marked `sourced`.
- Prefer primary sources: the vendor's own site, published price lists,
  official datasheets, spec sheets. Then authorized-reseller listings and
  distributor catalogs (e.g. B&H, CDW, ADI, Anixter-type sellers).
- **Most enterprise security vendors don't publish list pricing — expect
  this often, especially for categories A and B.** When a primary or
  reseller source doesn't exist, don't stop at "no public price": search
  secondary evidence before falling back to an estimate — G2/Capterra/
  Gartner Peer Insights reviews that mention price ranges, installer/IT-admin
  discussion threads (Reddit, AVSForum, IPVM forums), industry analyst
  reports, and press coverage of funding rounds or pricing changes. Weigh
  multiple independent mentions higher than a single anecdote, and still
  mark these `sourced` with the URL(s) if the number is a real reported
  figure, not something you inferred — reserve `estimated` for numbers you
  are the one inferring or approximating, not for real numbers found in
  secondary rather than primary sources.
- Record the **currency, the date the price was observed, and the unit
  basis** (per camera, per channel, per year, one-time, MSRP vs. street).
  Put these in `reasoning` or `notes`. Assume USD unless a vendor's own
  pricing is region-specific and you're sourcing a non-US page — say so.
- When pricing is quote-only, opaque, or "contact sales," say exactly that.
  Do not manufacture a number to fill the slot.
- **Never invent a URL.** A fabricated or guessed source is worse than no
  source. If you cannot find a page, the field is `estimated`, not
  `sourced`.
- Paraphrase spec descriptions. Do not paste long verbatim datasheet prose.
  Numeric specs and short factual attributes are fine to record.

### 4. Estimation rules (when no public price or credible secondary
evidence exists)

If a value cannot be sourced (directly or via secondary evidence), you may
still estimate, under these constraints:

- Mark it `estimated`. Never present an estimate as sourced.
- **Do not fabricate false precision.** Prefer a range or a qualitative
  band over a single invented dollar figure. `"$2,400–$3,600 / camera / yr"`
  with reasoning beats `"$2,988"` pulled from nowhere.
- The `reasoning` field is **required** for every estimate and must explain
  the basis: comparison to a sourced peer, a known list-to-street discount
  pattern, channel-count math, published anchor plus adjustment, etc.
  "Industry knowledge" alone is not sufficient reasoning; tie it to
  something concrete.
- Set `confidence` honestly. An estimate anchored to a sourced comparable is
  `medium`; a broad market-feel guess is `low`.

---

### 5. Output format

One markdown section per vendor for human skimming, in this shape:

```
### <Vendor Name> (<category>)

- cameraCost: $1,200/cam | sourced | https://example.com/pricing (checked 2026-07-25)
- tierPrice/tierYears: $1,099 for 5yr ($219.80/yr) | sourced | https://example.com/pricing
- applianceCost/applianceCapacity: n/a (no connector product found)
- supportAddonPerCamYr: $0 (appears bundled) | estimated, medium confidence, based on marketing copy claiming "all-inclusive pricing" at https://example.com/why-us, no explicit line-item confirmation
- discountPct: unknown, no public or secondary data found
- notes: <anything about pricing model, minimum commitments, etc.>
```

Then, once all vendors are done, also produce a single JSON (or TS-literal)
array matching this shape, so provenance travels with each field instead of
being collapsed into one shared list per vendor:

```ts
type FieldStatus = "sourced" | "estimated";
type Confidence = "high" | "medium" | "low";

interface FieldMeta {
  value: unknown;      // the value that goes into SolutionInputs (number, string, range, etc.)
  status: FieldStatus;
  confidence: Confidence;
  sources: string[];   // URLs; MUST be non-empty when status === "sourced"
  reasoning?: string;  // REQUIRED when status === "estimated"; also use to record unit basis / currency / date observed
  checkedOn: string;   // ISO 8601 date you performed the search, e.g. "2026-07-25"
}

interface VendorDefaultEntry {
  vendor: string;
  category: "cloud-hybrid-vms" | "onprem-vms-software" | "onprem-camera-hardware";
  pricedModel?: string; // for cameras: the exact model you anchored on
  inputs: Partial<SolutionInputs>;      // clean values only, for eventual merge
  fieldMeta: Record<string, FieldMeta>; // keyed by the same field names as `inputs`
  notes?: string; // omitted fields and why; quote-only pricing; caveats; roster changes
}
```

Rules for the objects:
- Keys in `fieldMeta` match keys in `inputs` one-to-one.
- `inputs` holds the bare values; `fieldMeta` holds the provenance. Do not
  lose the pairing.
- Every `sourced` field has at least one URL in `sources`. Every
  `estimated` field has `reasoning`.
- `checkedOn` is set per field (or note in `notes` if a single search date
  covers the whole vendor).

---

### 6. Process

1. Work vendor by vendor, category by category. Search per vendor rather
   than one broad query, so you get real listing pages, not aggregators.
2. For each applicable field: search, prefer a primary source, then
   secondary evidence (§3) before falling back to an estimate. Capture
   value + URL(s) + unit basis + observation date. If nothing credible
   exists at all, estimate against a sourced anchor and write the
   reasoning.
3. Normalize units to whatever the `SolutionInputs` fields expect (§1);
   state any conversion in `reasoning`.
4. Fill `notes` with omitted-field explanations and anything a reviewer
   needs to sanity-check the merge.

### 7. Deliverable

- The markdown vendor sections (§5) followed by the JSON/TS-literal array
  of `VendorDefaultEntry` (§5), grouped or sortable by category.
- A short **coverage summary** up top: how many fields per category came
  back `sourced` vs. `estimated`, and where the biggest gaps are, so the
  reviewer knows what to spot-check first.
- No file writes. No auto-merge. This is a review artifact for a human to
  inspect before it becomes `lib/vendorDefaults.ts`.
