# Access Control TCO Calculator

A guided wizard comparing the total cost of ownership of two access control
deployments: cloud-managed vs. server-based, two cloud systems, or two
server-based ones. It's the sibling of the video surveillance calculator
(`/professional/tco-calculator`) and follows the same rules: public, so
vendor-agnostic and even-handed; either side can be any provider; not
indexed (`robots: { index: false, follow: false }`); unaffiliated with every
vendor it names.

Everything that isn't access-control-specific (escalation, incumbent
handling, residual credit, misc items, failure cohorts, crossover detection,
share links, saved comparisons, the checklist, sensitivity, exports, the
business impact engine, and the UI pieces around them) lives in
`app/professional/_tco-shared/` and is used by both calculators. This README
covers only what's specific to access control; the video calculator's README
explains the shared rules in more depth.

## Design principles

These were settled before any code, because they decide whether the tool is
fair:

1. **Same defaults for both deployment models, unless the difference is
   physical.** The video calculator's biggest known bias risk is unsourced
   per-deployment-model staff-time defaults (cloud admin hours, investigation
   hours, truck rolls) that drive most of its gap. Here, admin hours per door,
   minutes per cardholder change, minutes per door alarm and truck rolls all
   default to the *same* value for cloud and on-prem. The one real structural
   difference, on-prem servers, is modeled as its own line (server hardware,
   server software, server patching hours) rather than baked into a bigger
   per-door admin number for on-prem.
2. **No vendor is pre-filled.** The wizard seeds each side with a
   placeholder name, not a vendor. When the user picks a researched vendor,
   only its sourced (or reviewer-confirmed) numbers apply, each with a source
   dot; a vendor whose license price is quote-only keeps the generic one and
   says so in its picker badge. See "Vendor defaults".
3. **Reuse is per layer and per solution.** Whether existing hardware can stay
   decides most of a migration's year-0 cost, and it's where vendors differ
   most. See "Reuse".
4. **Business impact defaults to zero change**, same as the video calculator.
   Most of its effects come from having access control at all, not from
   which system.

## Units

- **Doors** (controlled openings) drive hardware, installation, door licenses
  and door alarms.
- **Readers per door** (1 for entry only, 2 for in/out) is a scenario fact,
  the same for both sides: it's the doors' design, not a vendor choice.
- **Cardholders** and their **turnover** drive credentials and cardholder
  admin. These scale with people, not doors.
- **Sites** drive the controller minimum (at least one per site) and truck
  rolls.

## Reuse

`ScenarioInputs.existingDoorsInstalled` asks whether the doors are already
wired for access control.

- **No** (new construction, or doors that have never had access control):
  every newly deployed side buys everything at year 0: door hardware (lock or
  strike, door position sensor, request-to-exit, power), readers, controllers
  and full per-door installation.
- **Yes**: door hardware and cabling stay, whoever wins, so neither side pays
  for them. A newly deployed side then decides two things for itself:
  - `reusesReaders`: keep the existing readers (common when they're Wiegand
    or OSDP and the new platform supports them), or buy new ones.
  - `reusesControllers`: keep the existing controllers/panels, or buy new
    ones. Many platforms, cloud and server-based alike, run on
    Mercury-compatible panels and can keep them; others only work with their
    own controllers. Defaults to **no** for every solution, the conservative
    choice, and the pre-share checklist asks to confirm it either way.
  Either way it pays per-door migration labor (re-terminating, swapping what
  changes, programming, testing), which is much less than a new install.
- **The incumbent** pays none of this.

Kept readers and controllers start at `existingHardwareAgeYears` old, and
when the other side is the incumbent, they fail on the incumbent's
reliability numbers, not the new solution's (the same rule as the video
calculator's connector).

**Credentials**: `reissueCredentials` (per solution, off by default) issues a
new card to every physical-card cardholder at year 0, for a move such as
125 kHz prox to secure cards. That usually means new readers too; the
checklist points it out when a side reissues credentials but keeps its
readers.

## Cost model (`lib/model.ts`)

Categories, in order:

| Category | What's in it | When |
|---|---|---|
| Door hardware | Lock/strike, DPS, REX, power, per door | Year 0, new doors only |
| Readers & controllers | Readers and controllers bought, plus failure replacements (hardware out of warranty, labor always) | Year 0 if bought; failures yearly |
| Servers (initial & refresh) | On-prem servers plus their server software | Year 0, then each refresh |
| Licenses/subscription | Cloud term per door and site fee; on-prem base + door licenses, then support renewal | See below |
| Installation | New-door install, or migration labor on existing doors | Year 0 |
| Credentials | Cards for new hires and lost cards, mobile credentials, any year-0 reissue | Yearly (reissue at year 0) |
| Truck rolls | Paid site visits for anything other than a hardware swap | Yearly |
| Admin labor | System admin per door, plus on-prem server patching per server | Yearly, staff time |
| Cardholder admin | Adds, removals and access changes × minutes each | Yearly, staff time |
| Alarm handling | Door forced/held alarms × minutes each | Yearly, staff time |
| Network / bandwidth | Extra internet/WAN per site | Yearly |
| Misc / other | User line items | Shared rules |
| Business impact: savings / added costs | See below | Year 1 on |
| Residual value (credit) | Unused service life past the horizon | Final year |

Staff-time categories (Admin labor, Cardholder admin, Alarm handling) stay in
every total but are reported separately, as in the video calculator.

- **Controllers** are sized like the video calculator's connectors: at least
  one per site, more if `doors / doorsPerController` needs it.
- **Failures**: readers and controllers are two fleets of install-year
  cohorts (shared `advanceCohorts`), both on the solution's
  `hardwareHalfLifeYears` and `warrantyYears`. Each failure costs
  `replacementLaborPerDevice`, plus the device price once its cohort is out
  of warranty. Lock hardware also wears out, but it's the same doors either
  way, so it's left out of both sides rather than guessed at.
- **Cloud licensing**: `tierPrice` per door per `tierYears` term, a lump sum
  at purchase and each renewal, plus `siteFeePerYr` for vendors that also
  charge per site. The incumbent's first renewal is at
  `yearsUntilLicenseRenewal`. Terms get the residual credit.
- **On-prem licensing**: `baseLicense + doorLicense × doors` once at year 0
  (not for the incumbent), then `carePct` of that every year, incumbent
  included.
- **On-prem servers**: `serverCount` (default 1) at `serverCost +
  serverSoftwareCost`, bought at year 0 and on `refreshCycleYears` (the
  incumbent's first at `yearsUntilNextRefresh`), with residual credit.
  `serverAdminHrsPerYr` per server goes to Admin labor. Cloud has none of
  these.
- **Credentials**: physical cards for `cardholders × (1 − mobileSharePct)`
  at `cardCost`, for new hires (`turnoverPct`) and losses
  (`lostCredentialPct`) every year; mobile credentials at
  `mobileCostPerUserYr` (0 means bundled) for the mobile share.
- **Cardholder admin**: `cardholders × (2 × turnoverPct + accessChangesPerCardholderYr)`
  events a year (each leaver is a removal plus a replacement's add) ×
  `cardholderChangeMinutes` × the admin rate.
- **Alarm handling**: `doors × doorAlarmsPerDoorMonth × 12 ×
  alarmMinutes` × the security staff rate.
- **Discount** applies to hardware, licenses and servers, never to labor,
  credentials or misc items.
- **Escalation, incumbent, residual credit, misc items, crossover, input
  clamping**: shared, identical to the video calculator.

## Business impact (`lib/verticals.ts`)

Same engine as the video calculator (shared), with its own catalog. Priced
categories are costs the business has today, changed by a % per solution:

- Theft & unauthorized entry (RL2), break-ins (RL3), insurance premiums
  (RL5)
- Staffed entrances (OI2): guard or attendant hours at doors
- Lock-up and unlock rounds: staff time opening and closing sites by hand
- Rekeying & lost keys: mostly relevant against a mechanical-key incumbent
- Access reviews & audit prep (CG1): hours at the admin rate
- Other tools & contracts (TCO4): key cabinets, separate visitor tools

Two new costs: biometric compliance (for biometric readers) and a door-alarm
monitoring service. Considerations (never priced): emergency lockdown (SF3),
door access audit trail, certifications, cybersecurity posture, unattended
operating hours (OI6, revenue), occupancy and space insights (revenue).
Out of scope: visitor and guest management, intercom, elevator control, and
video (priced by the video calculator).

Cardholder admin, the access-control half of the framework's OI1, is already
in the core model, so it isn't repeated here.

## Wizard (`page.tsx`)

Intro → Comparison (shape, incumbent, are doors already wired, hardware age)
→ Scenario (doors, sites, readers per door, cardholders, turnover, horizon;
advanced: losses, access changes, alarms, rates, escalation, residual) →
Solutions (provider, discount, licensing, hardware and reuse, credentials,
operations) → Business impact (optional) → Results. Same share-link,
`?step=`, save, export and checklist behavior as the video calculator.

## Vendor defaults (`lib/vendorDefaults.ts`)

Researched from `RESEARCH_PROMPT.md` (2026-10-27) and reviewed before merging
(2026-11-12). Vendor research only fills prices, warranty, and hardware
compatibility; staff time, labor, door hardware, discount, servers, and card
prices are never set per vendor.

- **Prices found**: Verkada and Rhombus (license, controller, reader,
  warranty), Kisi (hardware only), LenelS2 OnGuard and Software House C•CURE
  (from MSRP price books posted on Minnesota's state procurement site),
  Paxton Net2 (2022 US price notice), Genetec Synergis (door license only,
  from IPVM).
- **Panel compatibility only**: Brivo, Avigilon Alta, Genea, Feenics/Acre,
  Avigilon Unity (all keep existing Mercury panels), AMAG and Gallagher (own
  controllers only). Their license prices are quote-only, and the secondary
  figures found were mostly competitors' blogs that disagreed by several
  times, so none was used.
- **Not researched**: Honeywell Pro-Watch, Identiv Hirsch Velocity, LenelS2
  NetBox.
- A value confirmed by a reviewer with access to the vendor's own sources
  but with no public page (Verkada's free Bluetooth unlock, its lack of
  Mercury support) is `estimated` with high confidence, not `sourced`:
  `sourced` means there's a page to cite.
- OnGuard's and C•CURE's researched licenses are reader-count tiers that hold
  only up to 64 readers (`LICENSE_READER_LIMITS`); the checklist warns past
  that while the researched price is still in place.

## Not built yet

- **Vendor research gaps**: see above. Re-run `RESEARCH_PROMPT.md` for the
  quote-only and unresearched vendors when better sources turn up.
- **Wireless locks**: integrated lock-and-reader hardware and its gateways
  aren't a separate door type. For a mixed site, enter blended per-door
  figures or use misc items.
- **Per-reader or per-cardholder licensing**: licenses are per door. For a
  vendor that licenses per reader, enter the per-door equivalent.
- **Intrusion panels, intercom, visitor management, elevators**: not priced.

## Default numbers

Every generic default is an unsourced placeholder, the same for both
deployment models unless noted: reader $300, controller $2,000 for 4 doors, door
hardware $1,000/door, new-door install $1,500/door, migration labor
$250/door, replacement labor $200/device, 12-year hardware half-life, 3-year
warranty, card $5, cloud license $250/door/yr (on-prem: $5,000 base,
$150/door, 18%/yr support, one $6,000 server with $2,000 of server software
on a 5-year refresh, 40 patching hours/server/yr), 1 admin hour/door/yr, 1
truck roll/site/yr, 10 minutes per cardholder change, 3 minutes per door
alarm. Replace them with quotes and the customer's own numbers.
