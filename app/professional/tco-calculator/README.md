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
  `Select`s merge a matched vendor's `values` on top of whatever's already
  filled in when picked, so switching vendors layers new numbers in without
  wiping unrelated fields; a vendor without an entry (or "Other") just keeps
  today's generic `defaultSolution()` values. Each entry's `fieldMeta` keeps
  per-field source URLs, sourced/estimated status, and confidence for future
  audit — not surfaced in the UI today, but there for whoever revisits a
  given number later. Not every listed provider has an entry yet; unresearched
  ones fall through silently, same as before this existed.
- A deployment-model abstraction (`"cloud" | "onprem"`) drives the cost
  formulas (`computeSolution`/`computeComparison`) instead of hardcoded
  vendor formulas, so on-prem-vs-on-prem, cloud-vs-cloud, and one-of-each
  all reuse the same code path.
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
- **Per-solution, not scenario-level**: `fleetHalfLifeYears`, `warrantyYears`,
  `framerateFps` all live on `SolutionInputs` since each side's camera
  hardware can have its own reliability/warranty/frame rate, even when
  comparing two deployments of the same type. A decay-driven camera failure
  still inside its warranty window costs only replacement labor, not the
  camera itself. `framerateFps` (default 24) is a secondary multiplier on
  top of `bitrateMbps` in the storage formula (`tbUsable`), not a
  replacement for it, and like bitrate it only has a computed effect on the
  on-prem branch (cloud storage is priced into the license, not derived
  from bitrate/framerate at all).
- **Cloud licensing**: free-form term/price per solution (not a fixed
  vendor's pricing tiers), plus a `supportAddonPerCamYr` field (default 0,
  "bundled into the license") for vendors that price support/analytics/
  extended retention separately instead of bundling everything into one
  flat number, that assumption is this tool's default, not a universal
  truth about every cloud vendor, so it's editable rather than hardcoded.
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
  capacity bought. That multiplied ("physical") capacity, not the raw
  usable figure, feeds both the storage cost and the on-prem power-draw
  estimate.
- **Analytics**: on-prem's `analyticsApplianceCost`/`analyticsSoftwareCost`
  get their own labeled "Analytics" sub-section in `AssumptionsPanel` (a
  `SectionLabel` div spanning the grid), separate from the flat field list,
  since cloud's equivalent cost is bundled into its license price by
  default and it wasn't obvious those two on-prem fields existed otherwise.
- **Escalation vs. discounting**: `annualEscalationPct` compounds every
  recurring cost year over year; NPV discounting (`npvDiscountPct`) is
  separate and applied on top, not a substitute for it.
- **Site-driven hardware minimums**: appliance/server unit counts assume at
  least one per site, not just enough for total camera count, since a
  connector/NVR box is physically local.
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
  incumbent for the on-prem-vs-cloud shape. When a shape has two slots of
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
- `InfoLabel`'s tooltip trigger is a real `<button>` with
  `events={{hover,focus,touch}}` set on the Mantine `Tooltip`, not just a
  hover-only icon: keyboard `:focus-visible` and touch both open it. Plain
  scripted `.focus()` calls in tests won't trigger it (Chromium doesn't
  mark those focus-visible), don't mistake that for a bug when testing,
  drive real Tab-key navigation instead.

All prices/discounts throughout are editable placeholder assumptions, not
real quotes.
