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

## Cost model (`lib/model.ts`, `lib/defaults.ts`, `lib/vendorDefaults.ts`)

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
  hardware refreshes still apply on schedule). Both sides pay their own
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
  which invited counting RAID overhead twice).
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
  for an incumbent (already owned).
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
  function, matching on-prem storage's already-continuous scaling and
  avoiding artificial cost cliffs at each threshold day.
- **RAID**: on-prem storage cost applies a redundancy multiplier
  (`SolutionInputs.raidLevel`, defaults to RAID 1). RAID 0 and no RAID need
  only the usable capacity; RAID 1 and RAID 10 roughly double the raw
  capacity bought (striping alone adds no capacity overhead, so RAID 10
  costs the same raw TB as RAID 1 for the same usable TB — the multiplier is
  identical for both). That multiplied ("physical") capacity feeds the
  storage *dollar* cost after one more step: `driveCountFor()`
  (`lib/model.ts`) converts it into a whole number of real drives — you
  can't buy a fraction of one — respecting each RAID level's minimum drive
  count (`RAID_MIN_DRIVES`: `none`/`raid1` need at least 1/2, `raid0` needs
  2, `raid10` needs at least *4*, since it's two mirrored pairs striped
  together, not one). That floor matters most at small scale: a tiny fleet
  on RAID 10 with large drives can be forced to buy far more raw capacity
  than the continuous multiplier alone would suggest, and both the storage
  cost and the `storageTB` hardware-footprint stat reflect that (`tbBilled`,
  not the continuous `tbPhysical`).
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
- **Analytics**: on-prem's `analyticsApplianceCost`/`analyticsSoftwareCostPerCam`/
  `analyticsSoftwareCostPerCamYr` get their own labeled "Analytics"
  sub-section in `AssumptionsPanel` (a `SectionLabel` div spanning the
  grid), separate from the flat field list, since cloud's equivalent cost
  is bundled into its license price by default and it wasn't obvious those
  fields existed otherwise. The appliance and the software license are
  billed on different bases, deliberately: `analyticsApplianceCost` is
  per-site (`* sites` wherever it's charged) — it's a physical box running
  against that site's own recording servers, so a multi-site deployment
  needs one at each site — and recurs on the refresh cycle, same as the
  servers/storage it's bundled with in "Hardware (initial & refresh)".
  Analytics *software*, by contrast, is licensed per camera analyzed, not
  per site: `analyticsSoftwareCostPerCam` (default $100) is a one-time
  purchase charged at year 0 alongside `baseLicense`/`deviceLicense` (same
  incumbent-zeroing, and — unlike the appliance — doesn't recur at
  hardware refresh, since a software license isn't tied to the server
  hardware it happens to run on); `analyticsSoftwareCostPerCamYr` (default
  $0) is a separate, purely additive ongoing per-camera cost for vendors
  that also charge a recurring analytics subscription on top of the
  one-time license. Both usages in `computeSolution` coerce through
  `Number(sol.x) || 0`, not the raw field — this pair replaced the single
  older `analyticsSoftwareCost` field, and an un-normalized old
  solution object (missing the new names entirely) would otherwise NaN out
  that whole year's total. `normalizeSolution()` backfills the real default
  (100/0) before this ever runs in the actual app; this is a last-resort
  guard in case some future path ever calls `computeSolution` without it.
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
- **Escalation, no NPV discounting**: `annualEscalationPct` compounds every
  recurring cost year over year. An earlier version also had a separate NPV
  discount rate (`npvDiscountPct`), removed to keep the tool to one
  time-value assumption. Note what that trades away: discounting *can*
  change the winner, because it weights each side by when its costs land
  (an earlier note here said it couldn't). Checked against the model: in a
  close comparison where cloud was about $23k cheaper undiscounted, a 5%
  rate made the on-prem incumbent cheaper. Without discounting, whichever
  side pays more up front (a fresh build, a prepaid multi-year term) is
  somewhat penalized relative to one that pays later. Restoring it as an
  optional, off-by-default setting is a reasonable future addition.
- **Site-driven hardware minimums**: appliance/server unit counts assume at
  least one per site, not just enough for total camera count, since a
  connector/NVR box is physically local.
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
- Share links round-trip the whole scenario through a `?s=`-encoded JSON
  query param (`lib/shareState.ts`); the address bar stays in sync via a
  debounced `router.replace`, wrapped in `Suspense` per Next's
  `useSearchParams()` requirement. "Download snapshot"
  (`lib/exportSnapshot.ts`, `html2canvas`) captures the stat tiles and
  charts as a PNG.
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
