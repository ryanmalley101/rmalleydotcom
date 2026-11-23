# Video Surveillance TCO Calculator

A guided wizard for comparing the total cost of ownership of two video-
management deployments, cloud vs. on-prem, cloud vs. cloud, or on-prem vs.
on-prem. Since it's hosted publicly, it's built to be vendor-agnostic and
even-handed rather than a pitch for any specific vendor: either side can
represent any provider, and the wizard states outright (intro screen,
results footer) that it's unaffiliated with every vendor it names.
`robots: { index: false, follow: false }` is set on both `/professional`
and `/professional/tco-calculator` metadata (`metadata` exports; verify via
the `<meta name="robots">` tag in rendered HTML, not just the source, if
this ever needs re-checking): deliberately not indexed, not full
auth-gated, "dampened" on purpose.

The parts that don't depend on what's being bought are shared with the
access control calculator (`/professional/access-control-tco`) and live in
`app/professional/_tco-shared/`: the year-by-year building blocks
(`lib/engine.ts`: misc items, refresh timing, failure cohorts, residual
credit, totals, crossovers), input clamping, vendor-default helpers, share
links and saved comparisons, the flip-point search, the CSV/printable
report builder, the spreadsheet writer and its comparison sheets, the business impact engine (`lib/impact.ts`), and the UI
around them (intro, shape cards, results header and summary, charts, year
table, gap drivers, checklist, business impact step, misc items). This
calculator's `lib/` keeps its own cost model, fields, defaults, vendor
tables, and business impact catalog, and wraps the shared pieces under the
same export names, so the rules below still describe where each behavior
lives even when the code is shared. A change to a shared piece changes both
calculators.

## Cost model (`lib/model.ts`, `lib/defaults.ts`, `lib/vendorDefaults.ts`)

- **Each quantity is written twice, side by side**: `lib/model.ts` defines
  the cost model as a table of entries (`DERIVED`, `LINES`, `RESIDUAL_LINES`,
  `RESIDUAL`, plus `simulateFleet` / `FLEET_SHEET` for camera failures). Each
  entry has `value`, the TypeScript the app runs, and `formula`, the same
  math as the Excel formula the spreadsheet export writes. `computeSolution`
  just runs the values in order, and `lib/spreadsheet.ts` just lays out the
  formulas. To change the cost math, edit both halves of the entry. `npm
  test` fails if they disagree: `spreadsheet.test.ts` builds a range of
  comparisons and checks every category's cost in every year against
  `computeComparison`, and checks every formula against HyperFormula, an
  independent spreadsheet engine. Each `value` keeps the original model's
  order of operations, so the table form gives bit-identical results.
- **Per-vendor defaults**: `lib/vendorDefaults.ts` holds three lookup tables
  (`CLOUD_VENDOR_DEFAULTS`, `ONPREM_VMS_VENDOR_DEFAULTS`,
  `ONPREM_CAMERA_VENDOR_DEFAULTS`) keyed by the exact strings in
  `lib/providers.ts`'s dropdown lists. `SolutionsStep.tsx`'s provider
  `Select`s call `switchVendor()`: any field still holding the previous
  vendor's exact value goes back to the generic default, then the new
  vendor's `values` merge on top. User edits survive (they no longer match
  the old vendor's value), but the old vendor's numbers don't leak into the
  new one, which they used to (switching the pre-filled Verkada to Meraki
  kept Verkada's reliability figures); a vendor without an entry (or "Other") just keeps
  today's generic `defaultSolution()` values. Each entry's `fieldMeta` keeps
  per-field source URLs, sourced/estimated status, and confidence for future
  audit — not surfaced in the UI today, but there for whoever revisits a
  given number later. Not every listed provider has an entry yet; unresearched
  ones fall through silently, same as before this existed.
- A deployment-model abstraction (`"cloud" | "onprem"`) drives the cost
  formulas (`computeSolution`/`computeComparison`) instead of hardcoded
  vendor formulas, so on-prem-vs-on-prem, cloud-vs-cloud, and one-of-each
  all reuse the same code path.
- **Cameras at year 0**: `ScenarioInputs.existingCamerasReusable` ("Can the
  existing cameras be reused?") decides who buys a camera fleet. When false
  (a new site, or cameras that have to go), every newly deployed side buys
  its full fleet at year 0 at its own `cameraCost`. When true (the default,
  matching the model's behavior before this question existed), a newly
  deployed side buys cameras only if it chose to replace them: cloud
  `migrationStrategy: "ripReplace"`, or on-prem
  `onpremCameraStrategy: "replace"` (the on-prem counterpart, shown only in
  that case). Otherwise it keeps the existing cameras and pays
  `bulkInstallLaborCost` as onboarding labor. A cloud "connector" side on a
  new site still buys its cameras plus its connectors. Camera purchases and
  replacements share the "Cameras" category; year-0 labor is always
  "Installation". The incumbent pays none of this. Before this existed,
  on-prem and connector sides never bought cameras even in a "fresh"
  comparison, while rip-and-replace always did.
- **Incumbent**: `ScenarioInputs.incumbent` zeroes one side's year-0
  buildout cost when it represents an already-deployed system (its later
  hardware refreshes still apply on schedule). The exception is a refresh
  or renewal that's due now: an incumbent with `yearsUntilNextRefresh`,
  `yearsUntilNextApplianceRefresh`, or `yearsUntilLicenseRenewal` at 0 buys
  that hardware or license term at year 0, then every cycle after. Before
  `MODEL_VERSION` 3, 0 bought nothing until a full cycle later, so a
  "servers due for replacement now" comparison couldn't be entered (found
  comparing against field TCO tools whose main scenario is exactly that).
  The access control calculator has the same rule. Both sides pay their own
  year-0 cost symmetrically otherwise. This includes an on-prem side's
  perpetual license purchase (`baseLicense` + `deviceLicense * cameras`),
  charged once at year 0 alongside the hardware for a non-incumbent side —
  not a recurring cost, and not charged at all for the incumbent, whose
  license really is already owned. Only the ongoing support/care renewal
  (`carePct`) recurs every year regardless of incumbent status. An earlier
  version of this model charged the renewal but never the underlying
  license purchase for either side, which understated a fresh on-prem
  deployment's cost any time neither side (or the *other* side) was
  incumbent — fixed since it contradicted this same symmetry principle.
- **Refresh timing differs by incumbency**: `yearsUntilNextRefresh` /
  `yearsUntilNextApplianceRefresh` describe hardware that's already installed
  and aging, so only the incumbent uses them (and `AssumptionsPanel` only
  shows them for the incumbent). A side that buys new hardware at year 0
  gets its first refresh one full cycle later (`refreshCycleYears` /
  `applianceRefreshCycleYears`). Before this, a fresh deployment also used
  the offset, so with the defaults it bought all its servers, storage, and
  analytics appliances at year 0 and again at year 2.
- **Silent-zero warning for stale refresh timing**: an incumbent's *only*
  path to ever charging server/storage/analytics-appliance cost (or the
  connector appliance cost) is a hardware refresh landing inside the
  horizon (year 0 is always skipped for it). If `yearsUntilNextRefresh` (or
  `yearsUntilNextApplianceRefresh`) is set to the horizon length or beyond,
  that whole cost line silently never appears anywhere in the comparison —
  discovered when incrementing `analyticsApplianceCost` visibly did nothing.
  `AssumptionsPanel`'s `StaleRefreshWarning` surfaces this inline (an
  `Alert` under the relevant "Years until next refresh" field) exactly when
  `isIncumbent && yearsUntilNextRefresh >= horizonYears`, so it's visible
  rather than a silent gap. Never fires for a non-incumbent: it always pays
  the full cost at year 0 regardless of refresh timing, so a refresh
  falling past the horizon there is a legitimate, harmless scenario, not a
  cost line quietly disappearing.
- **Separate hardware and license discounts**: `discountPct` (cameras,
  connectors, servers with their software, storage, analytics appliances)
  and `licenseDiscountPct` (cloud license terms and add-ons, on-prem
  perpetual licenses, support renewals, analytics software), since quotes
  commonly discount the two differently. One field used to cover both;
  `normalizeSolution` (and `sanitizeSolution`, for anything not normalized)
  copies an older link's discount into `licenseDiscountPct`, so old totals
  don't move. The generic defaults set both to the same 30% / 25%.
- **Per-solution, not scenario-level**: `fleetHalfLifeYears` and
  `warrantyYears` live on `SolutionInputs` since each side's camera
  hardware can have its own reliability/warranty, even when comparing two
  deployments of the same type. A decay-driven camera failure still inside
  its warranty window costs only replacement labor, not the camera itself.
- **Half-life is derived from warranty**: every vendor's default
  `fleetHalfLifeYears` is `1.5 × warrantyYears` (`halfLifeForWarranty` in
  `lib/defaults.ts`, floored at 1.5 years), on the reasoning that warranty
  length is the most comparable public signal of expected camera life.
  Vendor entries no longer store half-lives (several were uncited guesses,
  e.g. 12 years for Verkada and Axis); `vendorValues()` derives one from the
  entry's warranty, and the source dot explains the derivation. Editing the
  warranty moves the half-life with it (`withWarranty`) unless the user has
  set their own half-life. Generic default: 3-year warranty, 4.5-year
  half-life.
- **Bitrate and storage price**: `bitrateMbps` is the average *recorded*
  bitrate per camera, which already reflects frame rate, so there's no
  frame-rate multiplier (an earlier `framerateFps` field scaled bitrate
  again relative to 24fps, double counting it for anyone entering a
  measured bitrate; old share links may still carry the key, which is
  ignored). It only affects on-prem storage sizing. `storageCostPerTB` is
  per *raw* TB: it's multiplied by the post-RAID whole-drive capacity
  (`tbBilled`), so the field says "$/TB raw" (it used to say "usable",
  which invited counting RAID overhead twice). Its default, `DEFAULT_STORAGE_COST_PER_TB`
  ($30, a raw surveillance-HDD estimate), is generic: VMS vendor entries
  no longer set it, since storage price doesn't depend on the VMS (they all
  set $30 while the generic default was $200, so picking a VMS silently
  repriced storage).
- **Camera failures are tracked by install-year cohort** (`computeSolution`):
  each cohort loses a constant share per year, `1 - 0.5^(1/halfLife)`, and
  every failure is replaced at this solution's own `cameraCost` /
  `replacementInstallLaborCost`, becoming a new cohort with this solution's
  own half-life and warranty that can fail in turn. A failure costs labor
  only while its cohort is within its warranty, counted from the cohort's
  install year. The year-0 cohort is the cameras already on site whenever
  this side keeps them (the incumbent, or a side reusing them), and is
  `ScenarioInputs.existingFleetAgeYears` old (default 0, i.e. new), so an
  old fleet's warranty may already be used up. The earlier model only
  decayed the original fleet, never letting replacements fail, which
  undercounted swaps by roughly a quarter to a half over 10-15 years, and
  treated every incumbent fleet as brand new for warranty. The results
  summary's "fleet replaced" stat is `hardware.originalFleetReplacedPct`
  from these same cohorts. Simplification: a warranty replacement gets a
  fresh warranty rather than the remainder of the original one.
- **Connector reuses the incumbent's fleet, not its own**: a cloud
  `migrationStrategy: "connector"` solution's ongoing "Camera replacements"
  cost is driven by `failureSource` in `computeSolution` — the *other*
  side's `fleetHalfLifeYears`/`warrantyYears`, not its own, whenever the
  other side is a real incumbent (`computeComparison` only passes
  `existingFleet` in that case). This matters: "connector" means reusing
  cameras that are physically still the *incumbent's* hardware until each
  one dies and gets swapped for a native camera, so it's the incumbent's own
  reliability/warranty that determines when that swap happens, not the
  cloud vendor's assumed numbers for hardware it doesn't even own yet. The
  swapped-in replacement is still priced at the cloud solution's own
  `cameraCost`/`replacementInstallLaborCost`, unchanged — only the failure
  *timing* moves. Without a real incumbent on the other side (a fresh
  comparison, or the cloud solution being incumbent itself), there's no
  actual installed fleet to draw numbers from, so it falls back to its own
  `fleetHalfLifeYears`/`warrantyYears` same as before this existed. Doesn't
  apply to `ripReplace` (buys the full native fleet at year 0 regardless).
- **Connector warranty is data, not a field**: `applianceWarrantyYears`
  stays in the model and vendor data for reference but isn't shown in the
  forms or exports, since it never affected a cost (connector replacement
  follows the refresh cycle). The wizard shows "Cameras per appliance"
  there instead, which does. Chart color pickers live on the results page,
  next to each solution's assumptions, not in the setup cards.
- **Cloud licensing**: free-form term/price per solution (not a fixed
  vendor's pricing tiers), plus a `supportAddonPerCamYr` field (default 0,
  "bundled into the license") for vendors that price support/analytics/
  extended retention separately instead of bundling everything into one
  flat number, that assumption is this tool's default, not a universal
  truth about every cloud vendor, so it's editable rather than hardcoded.
  `tierPrice` is billed as a lump sum at purchase and at every renewal —
  year 0, then every `tierYears` thereafter (`y % tierYears === 0`, skipped
  in the horizon's final year, same convention as the on-prem/appliance
  refresh cycles) — not smoothed evenly across each year of the term the
  way an earlier version of this model did (`tierPrice / tierYears`,
  charged every single year regardless of where the actual renewal falls).
  A 5-year license is a single 5-year payment, not a de-facto annual
  subscription at a fifth the price. `supportAddonPerCamYr`, by contrast,
  genuinely is annual (it's named and priced that way), so it's charged
  every year regardless of the term-renewal cycle, separate from
  `tierPrice`. Renewals recur regardless of incumbent status, same as the
  on-prem support/care renewal — only the *first* term purchase is skipped
  for an incumbent (already owned). The incumbent's first renewal comes at
  `yearsUntilLicenseRenewal` (shown only for the incumbent; absent means
  one full term from year 0, the old behavior) and every term after, so an
  incumbent whose term ends next year isn't given years of free license.
  `migrationStrategy` (`"connector" | "ripReplace"`): "connector" reuses the
  existing camera fleet behind a connector/NVR-style appliance, with
  cameras swapped for native ones only as they fail; "ripReplace" buys out
  the whole fleet at year 0 with no appliance. The connector appliance's
  refresh cadence (`applianceRefreshCycleYears`,
  `yearsUntilNextApplianceRefresh`, default 7yr) is fully editable, matching
  on-prem's `refreshCycleYears`/`yearsUntilNextRefresh` pattern; it used to
  be a hardcoded `y % 10 === 0` with no UI control at all, which was the
  one place in the model a user couldn't adjust the assumption even if they
  disagreed with it.
- **Retention**: a continuous curve (`(days/30)^0.4`, fit against an
  earlier discrete 30/60/90/180/365-day step table) rather than a step
  function, avoiding artificial cost cliffs at each threshold day. It's
  floored at 30 days (it used to extrapolate below, cutting the license 44%
  at 7 days, beyond the data it was fit to), and it only applies when
  `SolutionInputs.retentionPricing` is `"scaled"` (the default). Vendors
  that record on the camera or a local appliance, like Meraki and Verkada,
  use `"flat"`: their longer retention is bigger hardware or a separate
  archive add-on, not a pricier license, so it belongs in those fields.
  Verkada's longer retention is priced through its connector models' 60-day
  tiers; for a flat vendor without retention-sized connector models (any
  rip-and-replace side, or Meraki), the pre-share checklist warns above 30
  days that the camera or connector price has to be for a model that holds
  that retention.
- **RAID**: on-prem storage is bought per recording server, since each
  active (non-spare) server holds its share of the footage on its own
  array. `drivesForArray()` (`lib/model.ts`) turns that server's usable TB
  into whole drives for `SolutionInputs.raidLevel`: RAID 1/10 double the
  data drives; RAID 5/6 add one or two parity drives per array of
  `raidArrayDrives` (default 8); no RAID and RAID 0 add none. Each level's
  minimum array size (`RAID_MIN_DRIVES`: RAID 10 needs 4, RAID 6 needs 4,
  RAID 5 needs 3) applies per server, so several small sites cost more
  storage than one big one. The billed whole-drive capacity (`tbBilled`)
  feeds both the storage cost and the `storageTB` footprint stat. RAID 5/6
  were added because they're the usual NVR setup (the Exacq entry had been
  mapped to RAID 10 for lack of them, doubling its drives); RAID 0 stays
  selectable only for older saved comparisons. Previously the minimum drive
  count was applied once to the whole fleet, which didn't capture the
  small-site case it was meant for.
- **Input validation** (`lib/sanitize.ts`): `computeSolution` and
  `computeComparison` clamp every numeric input to a usable range before any
  math (counts and cycle lengths rounded to whole numbers, half-life at least
  0.5, horizon 1-30, and so on), with a per-field fallback for a missing or
  non-numeric value. A cleared form field becomes 0, and before this a 0
  half-life turned every total into NaN, a 0 refresh cycle silently disabled
  refreshes, and a spare-server count of 0 was read as the default of 1.
  `SolutionResult.byYear` holds the escalated per-category cost for each
  year, for the year-by-year view and for tests.
- **Storage overhead and spare servers, editable**: `storageOverheadMultiplier`
  (default 1.3, i.e. 30%) is the metadata/audio/keyframe-indexing overhead on
  top of the raw video-bitrate math in `tbUsable`, feeding on-prem storage
  sizing; `spareServers` (default 1) is the hot-spare recording-server
  headroom added to `nSrv` beyond whatever capacity actually requires, once
  per solution, not once per site. Both were previously bare, un-editable
  constants (`1.3` and `+ 1`) with no field behind them at all — real
  assumptions, not fixed facts like a unit conversion, so they're real
  `ScenarioInputs` fields with a `DEFAULT_*` constant and
  `Number(scenario.x) || DEFAULT_X` fallback for older share links/saves
  missing them.
- **No electricity/power-draw modeling**: an earlier version priced a
  "Power/facilities" category two different ways in turn — first flat,
  unsourced kW-per-category guesses, then real per-device wattages
  (server/camera/drive/appliance). Both were removed for good: the flat
  version for being too speculative, and the wattage version — even though
  more defensible — for not moving the comparison enough to be worth the
  added fields and complexity. `driveCapacityTb` survived that removal
  because it also drives whole-drive storage *billing* (see RAID above),
  independent of power draw.
- **Analytics**: on-prem analytics is a per-solution switch,
  `analyticsEnabled`, off by default. Cloud solutions are assumed to bundle
  AI video search into their license. On-prem used to always pay for
  analytics (a $25k appliance per site plus $100/camera software) while
  still carrying four times the cloud's investigation hours, so it paid for
  faster search without getting it. Now, off means no analytics costs and
  the slower `INVESTIGATION_HRS_WITHOUT_SEARCH` default (3); on adds the
  costs and `withAnalytics()` (`lib/defaults.ts`) moves that side's hours
  to `INVESTIGATION_HRS_WITH_SEARCH` (0.75), unless the user entered their
  own hours. The appliance is sized by camera count
  (`analyticsApplianceCapacity`, default 50), not one per site, which made
  100 cameras cost $188 each at one site and $9,375 each at 50. Both the
  $25k price and the capacity are unsourced placeholders, flagged in their
  help text and in the pre-share checklist when analytics is on. The
  per-camera software (`analyticsSoftwareCostPerCam`, one-time at year 0,
  owned by the incumbent) and optional subscription
  (`analyticsSoftwareCostPerCamYr`) also apply only when it's on. Older
  links that carried analytics costs normalize to on, keeping their
  investigation hours.
- **Residual value at the horizon end**: `ScenarioInputs.creditResidualValue`
  (default on, a switch in the Scenario step's Advanced section) credits back
  the unused share of every lump purchase with a fixed service life that
  runs past the horizon, straight-line: cloud license terms (life
  `tierYears`), on-prem server/storage/analytics-appliance purchases (life
  `refreshCycleYears`), and connector appliances (life
  `applianceRefreshCycleYears`). A purchase in year p serves years p+1
  through p+life. The credit is its own category, "Residual value
  (credit)", applied in the final year (so the cumulative chart dips there).
  Without it, a six-year horizon paid for two full five-year cloud terms,
  and a year-7 refresh in a ten-year horizon was billed in full for three
  years of use. Cameras and perpetual licenses aren't credited: neither has
  a fixed service life in this model. `activeCategories` filters on
  `Math.abs`, so credits (this, and negative misc items) appear in the
  category chart.
- **Escalation, no NPV discounting**: three escalation rates compound year
  over year, applied to each cost as it's charged: `laborEscalationPct`
  (install and replacement labor, truck rolls, admin, investigations, misc
  items), `hardwareEscalationPct` (cameras, servers, storage, appliances),
  and `licenseEscalationPct` (licenses, subscriptions, support renewals).
  They replaced a single `annualEscalationPct`, which applied labor-style
  growth to hardware too even though hardware, storage especially, tends
  to get cheaper; `normalizeScenario` copies an old link's single rate into
  all three, and the defaults (3% each) match the old behavior. An earlier version also had a separate NPV
  discount rate (`npvDiscountPct`), removed to keep the tool to one
  time-value assumption. Note what that trades away: discounting *can*
  change the winner, because it weights each side by when its costs land
  (an earlier note here said it couldn't). Checked against the model: in a
  close comparison where cloud was about $23k cheaper undiscounted, a 5%
  rate made the on-prem incumbent cheaper. Without discounting, whichever
  side pays more up front (a fresh build, a prepaid multi-year term) is
  somewhat penalized relative to one that pays later. Restoring it as an
  optional, off-by-default setting is a reasonable future addition.
- **Network, server software, management servers**: three optional lines,
  all defaulting to 0 so they don't change a comparison until filled in.
  `networkCostPerSiteYr` (both models, its own "Network / bandwidth"
  category, escalating with labor and services) covers extra internet/WAN
  cost such as upload bandwidth for a vendor that records to the cloud.
  On-prem `serverSoftwareCost` (per server: Windows Server, SQL Server)
  and `managementServers` (non-recording management/database/failover
  servers at `serverCost`) are bought with the recording servers at year 0
  and every refresh, inside "Hardware (initial & refresh)".
- **Site-driven hardware minimums**: appliance/server unit counts assume at
  least one per site, not just enough for total camera count, since a
  connector/NVR box is physically local.
- **Connector models** (`SolutionInputs.applianceOptions`, `ConnectorFields`):
  a cloud vendor whose connectors come in sizes and storage tiers lists them
  as `{ label, cost, capacity, retentionDays }`, and the model uses the
  cheapest that covers the cameras (`chooseApplianceOption`), in place of
  the single `applianceCost`/`applianceCapacity`. A model holding
  `retentionDays` at full load serves `floor(capacity × min(1,
  retentionDays / scenario retention))` cameras at longer retention (null
  days: capacity doesn't depend on retention); units are `max(sites,
  ceil(cameras / that))`, as for the single appliance; ties go to the first
  listed. Every unit is the same model, and cameras are assumed spread
  evenly across sites, as before. The spreadsheet sizes each model on the
  Inputs sheet (`APPLIANCE_SHEET`, with spare rows) and picks the cheapest
  with `INDEX`/`MATCH`/`MIN`, so it stays live. Only Verkada has a list
  today, its six Command Connector models from its own datasheet: other
  connector vendors don't publish a range of models with prices and
  capacities (Avigilon Alta's A600 comes in 8TB and 16TB at the same 25
  cameras, with no published retention for either, so a list would add
  nothing). Anyone can add models for any vendor in the form. The default
  comparison's Verkada total moved from 520,015 to 503,980 with this, since
  the CC500 fits its 20-camera sites for less than the CC700.
- **Misc / other**: `SolutionInputs.miscItems` is a free-form list
  (`MiscCostItem[]`, `lib/model.ts`) rather than the two fixed
  `miscUpfrontCost`/`miscAnnualCost` fields this replaced — each item has its
  own `label`, `amount`, and `timing` (`"upfront"` | `"recurring"` |
  `"once"`, the last with its own `year`), edited
  via `MiscItemsEditor` (its own component, since it's a repeatable
  add/remove list rather than a flat field). This exists specifically so a
  user can justify value with their own named line items (e.g. "Workers comp
  claim reduction") without this tool having to name/model every possible
  one in advance — `amount` can be negative, a cost *offset*/credit is just
  a misc item with a negative amount, the same mechanism as a misc cost.
  Applied at face value (no vendor `discountPct`) — these are user-authored
  numbers unrelated to vendor pricing, not a vendor SKU. `"upfront"` items
  land in year 0, `"recurring"` items every year after, and `"once"` items
  in their chosen year, all escalating with their year. All three apply to
  the incumbent too: they used to be zeroed for it like the buildout, which
  silently ignored a real known cost such as replacing end-of-life NVRs. `normalizeSolution()` (`lib/defaults.ts`) migrates an older
  share link/saved comparison's flat `miscUpfrontCost`/`miscAnnualCost` into
  equivalent named items on load, so old data isn't silently dropped.
  Industry costs like theft and injury claims now have their own home in
  business impact (below); misc items stay the catch-all for anything else.
- **Business impact (`lib/verticals.ts`, `BusinessImpactStep`)**: the
  wizard's optional fourth step, also on the results page as its own
  accordion panel. Built from a value-proposition framework of 34 props in
  five pillars (Safety SF1-8, Risk & liability RL1-5, Operational impact
  OI1-9, Compliance & governance CG1-6, Total cost of ownership TCO1-6),
  with each category's framework `code` kept in the data (never shown in
  the UI; vendor product names from the framework are replaced by generic
  capabilities). Every prop lands in exactly one of four places:
  - **Priced (16)**: SF1, SF8, RL1, RL2, RL3, RL5, OI2, OI3, OI4, OI5, CG1,
    CG3, CG5, TCO3, TCO4, TCO6, each a cost the business has today
    (`"existing"`), sized per site from shared inputs
    (`ScenarioInputs.outcomeBaseline`, falling back to each input's
    placeholder) and changed by a % per solution
    (`SolutionInputs.outcomeChanges`). Hour-based ones (CG1, CG3) are
    costed at the scenario's admin rate. Defined once in `PRICED`; an
    industry overrides only wording and placeholders (`specsFor`), or swaps
    a prop for custom categories (retail splits RL2 into outside and
    employee theft, sharing sales and shrink inputs).
  - **Already in the core model (4)**, deliberately not repeated: SF7
    (hours per investigation), TCO1 (servers/NVRs/storage), TCO2 (admin
    hours, truck rolls), TCO5 (install labor).
  - **Considerations (9)**: SF2, SF5, SF6, RL4, CG2, CG4, CG6, plus revenue
    items OI7 and OI8. No credible dollar figure, or revenue rather than
    cost; several are how a priced saving happens (SF2 alerts → RL2/RL3),
    so pricing them would double-count. Ticked per solution
    (`SolutionInputs.considerations`, incumbent included), shown as "+ N
    other considerations, not in totals" in the summary and in exports,
    never added to a total.
  - **Out of scope (5)**: SF3 lockdown, SF4 vape/air quality, OI1
    front-desk and credential admin, OI6 unattended hours, OI9 fleet
    uptime. They need access control, sensors, intercom, guest management,
    or fleet products, which this calculator doesn't price; counting their
    benefit without their cost would tilt the comparison. The step lists
    them in a scope note. Pricing those product lines is a separate,
    larger project.

  Beyond the framework, three `"new"` categories (face recognition
  compliance, alert review time at the investigator rate, remote
  monitoring) take each solution's own amount. The framework lists only
  benefits; these keep the tool even-handed.

  Industries (`VERTICALS`): K-12 & Higher Ed, Retail & Convenience,
  Healthcare, Logistics & Transportation, Manufacturing & Industrial,
  Property Management & CRE (the framework's six), plus Finance, which the
  framework has no section for (its suggested set, RL2 teller fraud, RL1,
  and CG1, is our own). Every industry offers all 16 priced props; picking
  one switches on (`ScenarioInputs.outcomeEnabled`) the ones its framework
  section names (`suggested`). Logistics is thin by design: most of its
  framework value is fleet, which is out of scope.
  - Categories are grouped by pillar, each rendered as its own card with a
    checkbox per category. An unchecked card shows only its checkboxes;
    checking one shows just the shared inputs it needs (`inputsInUse`) and
    its change row. A category that's off counts for nothing, but keeps
    its entered values. Every input, category, and group names an icon
    (`OutcomeIcon`, a string so `lib/` stays React-free;
    `BusinessImpactStep`'s `ICONS` maps it to a lucide icon) shown beside
    its label.
  - Every value is a change *from today*, so **the incumbent never carries
    one**: today's shrink and claims already reflect the system that's
    installed. `computeSolution` skips the incumbent's changes even if
    present. On a new site, both sides are changes from having no system.
  - Every change defaults to 0 and the shared inputs' placeholder defaults
    don't move any total on their own. This is deliberate and the main
    bias guard: these are the least verifiable numbers in the tool, and
    vendor case studies are the usual source of "X% shrink reduction"
    claims. Don't ship non-zero default changes per vendor or per deployment
    model; most of these effects come from having cameras and analytics at
    all, not from cloud vs. on-prem.
  - Results go into two categories, "Business impact: savings" (negative)
    and "Business impact: added costs", from year 1 on, escalated with
    labor. Both are in every total but reported separately
    (`OUTCOME_CATEGORIES`, `SolutionResult.outcomeTotal`, so `cashTotal`
    excludes them), and the checklist flags a gap that's mostly business
    impact, plus any placeholder input behind a change someone entered.
  - A side's total can go negative once its savings exceed its costs. The
    results summary drops its "N% less" sentence then (it stops meaning
    anything) and says the savings exceed the costs instead.
  - Not yet built: tying a change to a feature the solution actually has
    (POS integration for employee theft, camera-based counting for people
    counters, the way the on-prem analytics switch ties cost and benefit
    together), and linking liability claims to `retentionDays` (footage
    overwritten before a late-filed claim can't help with it). The help
    text tells users to claim these only where they apply.
- **Crossover detection**: `computeComparison`'s search starts its baseline
  at whichever year first has a nonzero cost gap (usually year 0, not year
  1, since an incumbent's side often starts at $0) and reports every later
  sign flip too (`laterCrossoverYears`), not just the first. Don't naively
  simplify the baseline back to starting at year 1.

### Known softball risks, not yet fixed

The tool's default *numbers* (not its logic) were inherited from an earlier,
single-vendor version rather than independently researched per competitor,
which creates some real, not-yet-fixed asymmetries worth knowing about
before trusting an unedited comparison:

- Partially fixed: `lib/vendorDefaults.ts` now seeds real per-vendor numbers
  (with source URLs and sourced/estimated confidence per field, see the file
  itself) for most `CLOUD_PROVIDERS`, `ONPREM_VMS_PROVIDERS`, and
  `ONPREM_CAMERA_PROVIDERS` entries, wired into `SolutionsStep.tsx`'s
  provider `Select`s. Rhombus and Eagle Eye Networks weren't part of that
  research pass and still fall through to the numeric cloud defaults
  (`cameraCost: 1200`, `applianceCost: 9999`, `applianceCapacity: 50`,
  `tierPrice: 1099`/`tierYears: 5`) inherited from the earlier single-vendor
  tool. Solink was researched but deliberately excluded: it prices per
  location ($175/mo), not per camera, which the model's fields can't
  represent without a real per-location pricing dimension.
- The "connector" migration strategy assumes every cloud vendor needs a
  dedicated appliance to reuse existing cameras. Some real cloud VMS
  competitors are more camera-agnostic, software-first platforms that can
  ingest existing streams with little or no dedicated local hardware in
  many deployments, this may make them look artificially more
  hardware-heavy than they'd really be.
- `adminHrsPerCamYr` defaulting low for cloud (currently 1) is directionally
  defensible on its own (centralized management genuinely tends to need
  less hands-on time than fragmented on-prem hardware), but the original
  default of 0.5 was a specific vendor's "10x less admin" marketing claim,
  universalized to every cloud competitor by default, including more open,
  multi-vendor-camera platforms that plausibly need more admin overhead
  than a closed single-hardware ecosystem.
- `investigationHrsPerIncident` (cloud 0.75 vs. on-prem 3) and
  `truckRollsPerSiteYr` (cloud 1 vs. on-prem 4) have the same problem and
  matter more: in the default comparison (Milestone/Axis incumbent vs.
  Verkada) admin, investigation, and truck-roll labor together make up
  about 85% of the cloud side's advantage, and investigation hours alone
  nearly half. None of the three is sourced or vendor-specific; they're
  per-deployment-model defaults. They're deliberately kept as-is (a
  decision, not an oversight), but made visible instead of buried: all
  three are in the wizard with help text saying they're unsourced, and the
  results summary reports each side's estimated staff time (admin +
  investigations, `STAFF_TIME_CATEGORIES` in `lib/model.ts`) separately
  from its cash cost, so a reader can see how much of a gap rests on them.

## Wizard UX and defaults (`page.tsx`)

- `Phase` is `"intro" | "wizard" | "results"`. A dedicated `IntroScreen`
  (title, one-line pitch, the non-affiliation disclaimer, a single "Start"
  button) comes before the `Stepper`, since the wizard's own step text used
  to read as a wall of text when it was the first thing on the page. A
  shared link skips straight to `"results"` and never shows the intro.
- `SHAPE_OPTIONS` leads with the on-prem-vs-cloud shape ("Cloud / Hybrid
  vs. On-Prem"), the most common real-world comparison. `seedSolution`/
  `defaultIncumbentFor` pre-fill a default name on the relevant slot per
  shape (currently a specific cloud provider name on the cloud slot, a
  specific VMS+camera pairing on the on-prem slot, both fully editable via
  the same dropdowns as any other choice) and default that on-prem side to
  incumbent for the on-prem-vs-cloud shape. Each shape card lists when that
  comparison fits ("Use this when" / "Keep in mind"), not pros and cons of
  a deployment model. When a shape has two slots of
  the same model, only slot A gets a pre-filled default, slot B stays an
  open placeholder, comparing a vendor against itself by default wouldn't
  make sense. These are workflow conveniences, always overridable, not
  changes to the underlying math, which stays symmetric by default.
- Step 1 asks, right under the comparison-type cards, whether either
  solution is already deployed and whether the existing cameras can be
  reused (`IncumbentPicker`), because both change every year-0 cost and
  which fields later steps show (refresh offsets and license renewal only
  for the incumbent, camera age only when existing cameras matter). It
  used to sit at the bottom of step 3. The results page's Scenario panel
  shows the same picker.
- The address bar tracks the wizard too, not just the results: once a
  comparison type is picked it carries `?s=` plus `&step=N`, so a refresh
  or browser back returns to the same step, and a link without `step`
  opens on the results. The top-left link reads "All professional tools"
  (it used to say "Back", same as the step navigation's Back button, while
  leaving the calculator) and confirms before leaving an unfinished setup.
- Training aids: the Scenario step offers example sizes
  (`lib/presets.ts`; they set only cameras, sites, and investigations, not
  any cost assumption); the results page opens with a "Before you share
  this" checklist (`lib/checklist.ts`) built from the inputs, flagging key
  fields still on generic placeholders, estimated vendor values, an
  incumbent fleet age or refresh/renewal timing left at its default, and a
  gap driven mostly by estimated staff time; and the intro screen links to
  the same calculation notes shown under the results (`lib/methodology.ts`).
- Share links round-trip the whole scenario through a `?s=`-encoded JSON
  query param (`lib/shareState.ts`); the address bar stays in sync via a
  debounced `router.replace`, wrapped in `Suspense` per Next's
  `useSearchParams()` requirement. "Download snapshot"
  (`lib/exportSnapshot.ts`, `html2canvas`) captures the stat tiles and
  charts as a PNG.
- The Excel export (`lib/spreadsheet.ts`) is a working model, not a dump of
  numbers. An Inputs sheet holds every assumption as blue input cells, with
  dropdowns for choices and source notes. A model sheet per solution, laid
  out from `model.ts`'s entries, derives every cost line year by year from
  those cells: unit counts and storage
  sizing, refresh and renewal timing, camera failures by install batch, and
  the residual credit. The shared Summary and Year by year sheets
  (`_tco-shared/lib/spreadsheet.ts`) add totals, crossover, and three native
  charts. Some choices are fixed when the file is exported: the horizon
  (number of year columns), each side's deployment model, and which business
  impact categories are on. Each side also gets five spare misc rows. The
  file is written by `_tco-shared/lib/xlsx/` with no runtime dependency, and
  `xlsx/formula.ts` fills in every formula's cached value, so previews that
  don't recalculate still show numbers. Business impact baselines stay live
  through each category's `formula` (`_tco-shared/lib/impact.ts`). A new
  custom `annualPerSite` needs a matching `formula`; the tests check that
  every category has one and that it matches.
- `ScenarioStep`'s and `AssumptionsPanel`'s `SimpleGrid`s use narrow,
  multi-column layouts (`{ base: 2, sm: 4 }` and `{ base: 2, sm: 3 }`) with
  a `leftSection` icon per field in `ScenarioStep`; values here top out in
  the tens of thousands, they don't need full-width inputs, and the icons
  help anchor a dense grid.
- `ScenarioStep`'s top-level "Key variables" grid only holds the handful of
  facts that actually define a comparison (camera count, sites, retention,
  horizon, bitrate, investigations/mo); escalation, market rates, and the
  storage-sizing assumptions (`driveCapacityTb`, `storageOverheadMultiplier`,
  `spareServers`) all live in one collapsed-by-default "Advanced" accordion
  instead, so a first pass at a comparison doesn't need to see them.

- **Field definitions live in one place**: `lib/fields.ts`
  (`SOLUTION_FIELDS` / `SCENARIO_FIELDS`) holds each input's label, help
  text, and valid range. Numeric solution inputs render through
  `components/SolutionField.tsx` in both the wizard and the results page, so
  a field can't be labeled or explained differently in the two places (they
  had drifted: e.g. "Support renewal (% of license/yr)" vs. "(%/yr)"), and
  the CSV/printable exports use the same labels. Add a new numeric input by
  adding it there, not by hand-building a `NumberInput`.

## Platform notes

- This route is the **one place in the app that uses Mantine instead of
  MUI**, a deliberate one-off per direct request, scoped via its own
  `layout.tsx` (`@mantine/core/styles.css` imported only here, so it
  doesn't leak into the rest of the site). Don't reach for Mantine
  elsewhere without checking this was intentional and not copied by habit.
  `/professional/layout.tsx` and `/professional/tco-calculator/layout.tsx`
  are Server Components purely for their `metadata` export (route-specific
  title/description, since a shared link should preview as something other
  than the generic root title); the actual MUI/Mantine theme providers live
  in sibling `*ThemeClient.tsx` Client Components they render.
- `/professional/error.tsx` is the only error boundary in the app (none
  existed anywhere else before this route).
- `SourceDot` (the per-field sourced/estimated dot) is a real button that
  opens a `Popover`, not a hover tooltip, so it's keyboard-reachable and the
  source links inside are clickable; every cited source is listed.
- `InfoLabel`'s tooltip trigger is a real `<button>` with
  `events={{hover,focus,touch}}` set on the Mantine `Tooltip`, not just a
  hover-only icon: keyboard `:focus-visible` and touch both open it. Plain
  scripted `.focus()` calls in tests won't trigger it (Chromium doesn't
  mark those focus-visible), don't mistake that for a bug when testing,
  drive real Tab-key navigation instead.

All prices/discounts throughout are editable placeholder assumptions, not
real quotes.
