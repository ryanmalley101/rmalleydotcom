import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSolution, halfLifeForWarranty, withWarranty } from "../defaults";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, fieldSourceInfo, switchVendor } from "../vendorDefaults";
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

test("half-life is 1.5 times the warranty for every vendor", () => {
  assert.equal(seedVerkada("b").fleetHalfLifeYears, 15);
  assert.equal(seedOnprem("a").fleetHalfLifeYears, 4.5); // Axis, 3-year warranty
  assert.equal(generic.fleetHalfLifeYears, 4.5);
  for (const table of [CLOUD_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS]) {
    for (const entry of Object.values(table)) assert.equal(entry.values.fleetHalfLifeYears, undefined);
  }
  assert.equal(halfLifeForWarranty(0), 1.5);
});

test("the derived half-life has a source dot explaining it", () => {
  const sol = seedVerkada("b");
  const meta = fieldSourceInfo("fleetHalfLifeYears", sol.fleetHalfLifeYears, CLOUD_VENDOR_DEFAULTS.Verkada);
  assert.equal(meta?.status, "estimated");
  assert.match(meta?.reasoning ?? "", /1\.5 times/);
});

test("half-life follows warranty edits unless the user overrode it", () => {
  const sol = seedOnprem("a");
  assert.equal(withWarranty(sol, 5).fleetHalfLifeYears, 7.5);
  assert.equal(withWarranty({ ...sol, fleetHalfLifeYears: 9 }, 5).fleetHalfLifeYears, 9);
});

test("storage price isn't set per VMS vendor", () => {
  for (const entry of Object.values(ONPREM_VMS_VENDOR_DEFAULTS)) assert.equal(entry.values.storageCostPerTB, undefined);
  assert.equal(defaultSolution("a", "x", "onprem").storageCostPerTB, seedOnprem("a").storageCostPerTB);
});
