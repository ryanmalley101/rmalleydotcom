# Research prompt: per-vendor access control TCO defaults

Hand the "Prompt" section below to a Claude
session with web search/browsing. It's self-contained: the `SolutionInputs`
type is pasted in full with its comments, so the runner doesn't need this
repo or any prior conversation.

**Why this exists:** every provider in `lib/providers.ts` currently uses the
same generic placeholders from `lib/defaults.ts`, and the wizard
deliberately doesn't pre-fill any vendor until real numbers exist (see the
README's design principles). This is step 5 of the build: researched,
per-field-sourced defaults for `lib/vendorDefaults.ts`
(`CLOUD_VENDOR_DEFAULTS`, `ONPREM_VENDOR_DEFAULTS`), which the provider
picker, source dots, confidence badge, exports, and checklist already read.

**Review before merging**, as with the video calculator's
`RESEARCH_PROMPT.md`: spot-check a few claims live, treat `estimated`
entries as a first draft, and expect a reshaping pass. Lessons carried over
from that research:

- Don't normalize vendors to a "parity" bundle by re-pricing their license.
  If something one vendor bundles is a separate SKU elsewhere, put that
  SKU's real price in its own field (`siteFeePerYr`, `mobileCostPerUserYr`)
  with a citation for that piece specifically.
- Drop a vendor whose pricing the model can't represent (e.g. priced per
  user only, with no per-door basis) rather than force-fitting it, and say
  so in its notes.
- A citation has to be a credible pricing source, not a page that merely
  mentions the vendor.

---

## Prompt

You are populating vendor defaults for a public, vendor-neutral access
control TCO calculator. Your output will be reviewed by a human and, if
approved, merged into `lib/vendorDefaults.ts`. **Do not write, edit, or
attempt to merge any file.** Produce a structured research artifact only.

Web search is required. Accuracy and honest provenance matter more than
completeness. A well-labeled gap is more useful than a confident guess.

---

### 1. The type you are filling

The calculator's `SolutionInputs` type, verbatim including comments.
`MiscCostItem` and `DeploymentModel` (`"cloud" | "onprem"`) are defined
elsewhere and aren't yours to fill. Do not invent field names.

```ts
interface SolutionInputs {
  id: "a" | "b";
  name: string;
  model: DeploymentModel;
  discountPct: number; // off list, this vendor's own negotiated discount

  // Door hardware and devices, both models.
  readerCost: number; // $/reader
  controllerCost: number; // $/controller, with its enclosure and power
  doorsPerController: number;
  // Lock or strike, door position sensor, request-to-exit, power: bought
  // only for doors that aren't wired yet.
  doorHardwareCost: number; // $/door
  // Full install on a door with nothing on it: cabling, lock hardware,
  // reader, controller wiring.
  newDoorInstallCost: number; // $/door
  // Cut-over on a door that's already wired: re-terminating, swapping what
  // changes, programming, testing.
  migrationLaborPerDoor: number; // $/door
  replacementLaborPerDevice: number; // $/failed reader or controller
  // Readers and controllers fail at a constant yearly rate set by this
  // half-life; a failure inside the warranty costs labor only.
  hardwareHalfLifeYears: number;
  warrantyYears: number;
  // Whether this solution keeps the existing readers / controllers when the
  // doors are already wired. Ignored on new doors and for the incumbent.
  reusesReaders: boolean;
  reusesControllers: boolean;

  // Cloud only
  tierPrice: number; // $/door for one term of `tierYears`
  tierYears: number;
  siteFeePerYr: number; // $/site/yr, for vendors that also charge per site
  // Incumbent only: years until the current term ends. Absent means one
  // full term from year 0.
  yearsUntilLicenseRenewal?: number;

  // On-prem only
  baseLicense: number; // one-time
  doorLicense: number; // $/door, one-time
  carePct: number; // yearly support renewal, % of the license
  serverCount: number;
  serverCost: number; // $/server
  serverSoftwareCost: number; // $/server: Windows Server, SQL Server
  serverAdminHrsPerYr: number; // patching and upkeep, per server
  refreshCycleYears: number;
  yearsUntilNextRefresh: number;

  // Credentials
  cardCost: number; // $/card
  // Share of cardholders on mobile credentials instead of a card.
  mobileSharePct: number;
  mobileCostPerUserYr: number; // 0 when the license includes them
  // Issue a new card to every card-carrying cardholder at year 0, e.g. to
  // move off 125 kHz prox. Ignored for the incumbent; always happens on new
  // doors.
  reissueCredentials: boolean;

  // Operations, both models. Same defaults for cloud and on-prem.
  adminHrsPerDoorYr: number;
  cardholderChangeMinutes: number;
  alarmMinutes: number;
  truckRollsPerSiteYr: number;
  networkCostPerSiteYr: number;

  miscItems: MiscCostItem[];
  // Business impact: see lib/verticals.ts. Ignored for the incumbent.
  outcomeChanges: Record<string, number>;
  considerations: string[];
}```

### 2. Fields to research, and fields to leave alone

**Research these** (only the ones that apply to the vendor's deployment
model):

- Cloud: `tierPrice` + `tierYears` (per door per term; if the vendor sells
  several terms, use the shortest commonly sold one and list the others in
  notes), `siteFeePerYr` (any per-site, per-controller, or per-account fee
  on top of door licenses).
- On-prem: `baseLicense`, `doorLicense` (convert per-reader pricing to per
  door, stating the assumption), `carePct` (support/SMA as % of license).
- Both: `mobileCostPerUserYr` (0 only with evidence that mobile credentials
  are included), `readerCost` and `controllerCost` + `doorsPerController`
  for the vendor's own hardware (if the vendor sells none and expects
  third-party hardware, say so and leave them out), `warrantyYears` for
  that hardware.
- Compatibility, as booleans with sources: `reusesControllers` (true only
  if the platform officially supports common third-party panels, such as
  Mercury, that an existing system is likely to have; name the supported
  panels in reasoning) and `reusesReaders` (true if it supports standard
  Wiegand and/or OSDP readers). These decide most of a migration's year-0
  cost, so cite the vendor's own hardware-compatibility page where one
  exists.

**Do not fill these**, even if you find marketing claims: `adminHrsPerDoorYr`,
`cardholderChangeMinutes`, `alarmMinutes`, `truckRollsPerSiteYr`,
`serverAdminHrsPerYr`, `hardwareHalfLifeYears`, `doorHardwareCost`,
`newDoorInstallCost`, `migrationLaborPerDoor`, `replacementLaborPerDevice`,
`discountPct`, `serverCount`, `serverCost`, `serverSoftwareCost`,
`refreshCycleYears`, `cardCost`. The calculator keeps these the same for
every vendor on purpose: they're the operator's or integrator's numbers, or
staff-time claims that a vendor's own marketing can't support. If a vendor
requires its own proprietary credentials (cards that only work with its
readers), note that and its card price in `notes`, but don't set `cardCost`.

### 3. Scope

About eight vendors per deployment model. The lists are starting points;
add, drop, or swap based on market relevance, and note any change. The
names must match these strings exactly where you keep them.

**Cloud-managed:** Verkada, Brivo, Avigilon Alta (Motorola Solutions),
Genea, Kisi, Rhombus, Feenics (Acre Security).

**Server-based (on-prem):** LenelS2 OnGuard, Software House C•CURE 9000,
Genetec Security Center (Synergis), Gallagher Command Centre, AMAG
Symmetry, Honeywell Pro-Watch, Avigilon Unity Access, Identiv Hirsch
Velocity, LenelS2 NetBox, Paxton Net2.

### 4. Sourcing rules (non-negotiable)

- **Every value presented as real requires a source URL.** No URL means it
  cannot be marked `sourced`. **Never invent a URL.**
- Prefer primary sources: the vendor's own price list, pricing page,
  datasheets, and compatibility pages. Then authorized-reseller and
  distributor listings.
- Most access control vendors are quote-only. Before falling back to an
  estimate, look for secondary evidence: review sites that mention prices,
  integrator and IT-admin discussions, analyst coverage. Several independent
  mentions outweigh one anecdote. A real reported figure from a secondary
  source is still `sourced` (with its URL); `estimated` is only for numbers
  you infer yourself.
- Record currency, observation date, and unit basis (per door, per reader,
  per site, per year, one-time, MSRP vs. street) in `reasoning`. Assume USD
  unless the only page is regional; say so.
- When pricing is "contact sales," say exactly that. Don't manufacture a
  number to fill the slot.

### 5. Estimation rules

If a value can't be sourced directly or through secondary evidence, you may
estimate, marked `estimated`, with `reasoning` tied to something concrete
(a sourced peer, a published anchor plus a stated adjustment). Prefer a
range in `reasoning` over false precision; put the midpoint in the value.
Set `confidence` honestly: anchored to a sourced comparable is `medium`, a
market-feel guess is `low`. "Industry knowledge" alone isn't reasoning.

### 6. Output format

One markdown section per vendor for skimming:

```
### <Vendor Name> (<cloud | onprem>)

- tierPrice/tierYears: $X per door for 1yr | sourced | https://... (checked YYYY-MM-DD)
- siteFeePerYr: $0 (none found) | estimated, low confidence, ...
- reusesControllers: true (supports Mercury LP/EP panels) | sourced | https://...
- notes: <pricing model, minimums, proprietary credentials, omitted fields and why>
```

Then a single TS-literal array, so provenance travels with each field:

```ts
type FieldStatus = "sourced" | "estimated";
type Confidence = "high" | "medium" | "low";

interface FieldMeta {
  value: unknown;      // the value that goes into SolutionInputs
  status: FieldStatus;
  confidence: Confidence;
  sources: string[];   // URLs; MUST be non-empty when status === "sourced"
  reasoning?: string;  // REQUIRED when status === "estimated"; also unit basis / currency / date
  checkedOn: string;   // ISO 8601 date of the search
}

interface VendorDefaultEntry {
  vendor: string;      // exactly as in §3
  model: "cloud" | "onprem";
  values: Partial<SolutionInputs>;      // bare values only
  fieldMeta: Record<string, FieldMeta>; // same keys as `values`, one-to-one
  notes?: string;
}
```

### 7. Deliverable

- A short coverage summary first: per deployment model, how many fields
  came back `sourced` vs. `estimated`, and the biggest gaps, so the
  reviewer knows what to spot-check first.
- The markdown sections, then the TS-literal array.
- No file writes, no merge. This is a review artifact.
