import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSolution } from "../defaults";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, switchVendor } from "../vendorDefaults";
import { seedOnprem, seedVerkada } from "./helpers";

const generic = defaultSolution("b", "x", "cloud");

test("switching vendors drops values the previous vendor set and the new one doesn't", () => {
  const meraki = switchVendor(seedVerkada("b"), "Verkada", "Meraki (Cisco)", CLOUD_VENDOR_DEFAULTS);
  assert.equal(meraki.warrantyYears, generic.warrantyYears);
  assert.equal(meraki.fleetHalfLifeYears, generic.fleetHalfLifeYears);
  assert.equal(meraki.tierPrice, CLOUD_VENDOR_DEFAULTS["Meraki (Cisco)"].values.tierPrice);
});

test("values the user edited survive a vendor switch", () => {
  const edited = { ...seedVerkada("b"), warrantyYears: 4 };
  assert.equal(switchVendor(edited, "Verkada", "Spot AI", CLOUD_VENDOR_DEFAULTS).warrantyYears, 4);
});

test("chained switches don't accumulate earlier vendors' values", () => {
  let sol = seedVerkada("b");
  sol = { ...switchVendor(sol, "Verkada", "Meraki (Cisco)", CLOUD_VENDOR_DEFAULTS), name: "Meraki (Cisco)" };
  sol = switchVendor(sol, "Meraki (Cisco)", "Spot AI", CLOUD_VENDOR_DEFAULTS);
  assert.equal(sol.cameraCost, generic.cameraCost);
  assert.equal(sol.discountPct, generic.discountPct);
});

test("picking Other resets the previous vendor's values", () => {
  const other = switchVendor(seedVerkada("b"), "Verkada", "", CLOUD_VENDOR_DEFAULTS);
  assert.equal(other.warrantyYears, generic.warrantyYears);
});

test("on-prem VMS switches reset that VMS's fields only", () => {
  const sol = seedOnprem("a");
  const q = switchVendor(sol, "Milestone XProtect", "Qognify", ONPREM_VMS_VENDOR_DEFAULTS);
  const onpremGeneric = defaultSolution("a", "x", "onprem");
  assert.equal(q.baseLicense, onpremGeneric.baseLicense);
  assert.equal(q.serverCost, onpremGeneric.serverCost);
  assert.equal(q.cameraCost, sol.cameraCost, "camera-vendor fields are untouched");
});
