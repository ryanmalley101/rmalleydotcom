# Research prompt: per-vendor TCO defaults

Hand the prompt below (everything after the `---`) to a Claude session that
has web search/browsing available. It's self-contained, it doesn't assume
the runner has access to this repo or any prior conversation context, so
the target schema and file paths are spelled out in full inside the prompt
itself.

**Why this exists:** `app/professional/tco-calculator/lib/defaults.ts`
currently gives every cloud provider the same numeric defaults (in practice,
one specific vendor's real published pricing) and every on-prem VMS+camera
pairing the same numeric defaults (one specific pairing's real pricing).
Picking a different provider from the dropdown changes the *name* shown but
not the *numbers* until a user manually edits them. See
`app/professional/tco-calculator/README.md`'s "Known softball risks"
section for the full writeup of why that's a problem worth fixing.

**What "done" looks like:** a new `lib/vendorDefaults.ts` exporting a
lookup table keyed by provider name, each entry a `Partial<SolutionInputs>`
plus source metadata, wired into the wizard's provider `Select`s so picking
a known vendor also seeds its own numbers (falling through to today's
generic defaults for "Other" or any vendor without researched data yet).

Review the output before merging it. Treat "confidence: estimated" entries
as a first draft, not a citation, they're explicitly not sourced.

---

## Prompt

You are researching publicly available pricing and specifications for
video-surveillance vendors, to populate default cost assumptions in a
total-cost-of-ownership calculator. The calculator lets a user pick a
vendor from a dropdown; today every vendor in a category shares identical
placeholder numbers, and you're producing per-vendor numbers to replace
that.

### Ground rules

1. **Prefer real, publicly published numbers over estimates.** Check the
   vendor's own pricing page, spec sheets, and datasheets first.
2. **Cite a source URL for every number you claim is real.** If you can't
   find a public source, say so explicitly, don't present a guess as if it
   were sourced.
3. **Most enterprise security vendors don't publish list pricing.** When
   that's the case (expect it often), search for secondary evidence
   instead: reseller/integrator price sheets, G2/Capterra/Gartner Peer
   Insights reviews that mention price ranges, industry analyst reports,
   Reddit/forum threads from installers or IT admins discussing real
   quotes, press coverage of funding/pricing changes. Weigh multiple
   independent mentions higher than a single anecdote.
4. **If you still can't find anything credible, say so and produce a
   clearly-labeled estimate** based on the vendor's market positioning
   (e.g. "premium/enterprise-tier," "budget/SMB-tier") relative to vendors
   you *could* source, with your reasoning stated. Never invent a
   specific-looking number (like `$1,247`) to sound more precise than your
   actual confidence, round to reflect genuine uncertainty (e.g. "~$1,200"
   or "$1,000-1,500").
5. **Every entry needs a `confidence` field**: `"sourced"` (you found a
   real public number and are citing it) or `"estimated"` (you're
   inferring/approximating). Don't mix the two within one field, one number
   is either sourced or it isn't.
6. Prices/specs drift. Note the date you found each number so staleness is
   checkable later.

### Categories and vendors

Research these three categories. For each, the starting list below came
from a survey of common competitors; feel free to research beyond it if
you know of a vendor that deserves inclusion (regional strength, notably
different pricing model, etc.), the goal is a representative top ~10 per
category, not this exact list.

**Cloud/hybrid VMS** (camera + cloud platform sold as one ecosystem, or
cloud platform + connector appliance for existing cameras):
Verkada, Rhombus, Meraki (Cisco), Eagle Eye Networks, Ava Security
(Motorola Solutions), Arcules. Consider also: Genetec Stratocast, Openeye,
Camio, Solink, IPConfigure Ozone.

**On-prem VMS software** (recording/management software, sold separately
from camera hardware):
Milestone XProtect, Genetec Security Center, Avigilon Control Center
(Motorola Solutions), Exacq (Johnson Controls), Network Optix (Nx Witness),
Salient Systems, Qognify. Consider also: Digifort, OnSSI (Ocularis), Hanwha
Wisenet WAVE, IndigoVision (Motorola Solutions).

**On-prem camera hardware** (sold separately from VMS software):
Axis Communications, Hanwha Vision, Bosch Security, Hikvision, Dahua
Technology, Pelco, Vivotek. Consider also: Uniview, i-PRO (Panasonic),
Avigilon (as a camera brand, distinct from its VMS), Teledyne FLIR.

### What to find, per vendor

For **cloud/hybrid VMS** vendors, find as many of these as you can (all
are $/camera unless noted; `n/a` if a field doesn't apply to how that
vendor prices, e.g. no separate connector-appliance product):

| Field | Meaning |
|---|---|
| `cameraCost` | List price of the vendor's own native camera hardware, $/camera |
| `tierPrice` + `tierYears` | Their license/subscription pricing: cost for a term of N years, $/camera. Capture whatever term lengths they publish (e.g. "$X for 1yr, $Y for 3yr, $Z for 5yr") |
| `applianceCost` + `applianceCapacity` | If they sell a connector/bridge/NVR-style box for reusing existing cameras: its price, and how many camera streams one unit supports |
| `supportAddonPerCamYr` | Is support/analytics/extended retention bundled into the base license, or a separate paid add-on? If separate, its $/camera/yr cost |
| `discountPct` | Typical street/negotiated discount off list price, if you can find any indication (this is usually the least likely to be public) |
| Anything notable about their pricing *model* itself | e.g. per-camera vs. per-stream vs. per-site pricing, minimum commitments, whether cameras must be purchased from them or third-party cameras are supported |

For **on-prem VMS software** vendors:

| Field | Meaning |
|---|---|
| `baseLicense` | One-time base/server license cost, if published |
| `deviceLicense` | Per-camera license cost, one-time |
| `carePct` | Annual support/maintenance renewal, as % of license cost/yr |
| `analyticsSoftwareCost` | Separate analytics module/add-on cost, $/yr, if sold separately from the base VMS |

For **on-prem camera hardware** vendors:

| Field | Meaning |
|---|---|
| `cameraCost` | Typical/representative camera list price, $/unit (note the model/tier you're citing, e.g. "2MP fixed dome, mid-tier") |
| `warrantyYears` | Published hardware warranty length |

### Output format

One markdown section per vendor, in this shape:

```
### <Vendor Name> (<category>)

- cameraCost: $1,200/cam | sourced | https://example.com/pricing (checked 2026-07-25)
- tierPrice/tierYears: $1,099 for 5yr ($219.80/yr) | sourced | https://example.com/pricing
- applianceCost/applianceCapacity: n/a (no connector product found)
- supportAddonPerCamYr: $0 (appears bundled) | estimated, based on marketing copy claiming "all-inclusive pricing" at https://example.com/why-us, no explicit line-item confirmation
- discountPct: unknown, no public data found
- notes: <anything about pricing model, minimum commitments, etc.>
```

Then, once all vendors are done, also produce a single TypeScript object
matching this shape (fill in only the fields you found data for; omit the
rest so they fall through to the calculator's existing generic defaults):

```ts
export interface VendorDefault {
  values: Partial<SolutionInputs>; // from app/professional/tco-calculator/lib/model.ts
  confidence: Record<string, "sourced" | "estimated">; // per-field
  sources: string[];
  checkedOn: string; // ISO date
}

export const VENDOR_DEFAULTS: Record<string, VendorDefault> = {
  "Verkada": { ... },
  "Rhombus": { ... },
  // ...
};
```
