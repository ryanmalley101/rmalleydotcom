import { test } from "node:test";
import assert from "node:assert/strict";
import LZString from "lz-string";
import { decodeShareState, encodeShareState, isStaleModel, solutionBaseline } from "../shareState";
import { MODEL_VERSION } from "../model";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS } from "../defaults";
import { seedSolution } from "../seeds";
import { ONPREM_CAMERA_VENDOR_DEFAULTS, switchVendor } from "../vendorDefaults";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR } from "../../../_tco-shared/lib/colors";
import { defaultIncumbentFor } from "../../../_tco-shared/lib/fields";
import { seedOnprem, seedVerkada, scenario } from "./helpers";

const state = { shapeId: "onprem-cloud", scenario: scenario({ incumbent: "a" }), solA: seedOnprem("a"), solB: seedVerkada("b"), colorA: "#000000", colorB: "#ffffff" };

test("share links round-trip and carry the current model version", () => {
  const decoded = decodeShareState(encodeShareState(state));
  assert.ok(decoded);
  assert.equal(decoded.modelVersion, MODEL_VERSION);
  assert.equal(decoded.solB.name, "Verkada");
  assert.equal(isStaleModel(decoded), false);
});

test("links without a model version are flagged as made with an older model", () => {
  const raw = JSON.stringify(state); // pre-compression, pre-versioning link format
  const decoded = decodeShareState(raw);
  assert.ok(decoded);
  assert.equal(isStaleModel(decoded), true);
});

test("garbage input decodes to null", () => {
  assert.equal(decodeShareState("not-a-link"), null);
});

// Links store only what differs from solutionBaseline (plus the seed fields
// it's built from), so it has to rebuild exactly what the wizard seeds;
// otherwise every link carries the gap.
test("the link baseline matches the wizard's seeding for every comparison shape", () => {
  for (const opt of SHAPE_OPTIONS) {
    for (const slot of ["a", "b"] as const) {
      const sol = seedSolution(slot, opt);
      const { id, name, model, vmsProvider, cameraProvider } = sol;
      const seed = JSON.parse(JSON.stringify({ id, name, model, vmsProvider, cameraProvider }));
      assert.deepEqual({ ...solutionBaseline(seed), ...seed }, sol, `${opt.id} ${slot}`);
    }
    const fresh = {
      shapeId: opt.id, scenario: { ...DEFAULT_SCENARIO, incumbent: defaultIncumbentFor(opt) },
      solA: seedSolution("a", opt), solB: seedSolution("b", opt), colorA: SOLUTION_A_COLOR, colorB: SOLUTION_B_COLOR,
    };
    const link = encodeShareState(fresh);
    assert.ok(link.length < 250, `${opt.id}: ${link.length} chars`); // the seed fields alone; nothing differs
    assert.deepEqual(decodeShareState(link), { ...fresh, modelVersion: MODEL_VERSION });
  }
});

test("an edited comparison with a switched vendor round-trips exactly and stays short", () => {
  const solA = { ...switchVendor(seedOnprem("a"), "Axis Communications", "Bosch Security", ONPREM_CAMERA_VENDOR_DEFAULTS), cameraProvider: "Bosch Security", miscItems: [{ id: "m", label: "Signage", amount: 900, timing: "upfront" as const }] };
  const edited = { ...state, scenario: scenario({ incumbent: "a", cameras: 240, vertical: "education" }), solA };
  const link = encodeShareState(edited);
  assert.ok(link.length < 400, `${link.length} chars`); // ~2.5K before the compact format
  assert.deepEqual(decodeShareState(link), { ...edited, modelVersion: MODEL_VERSION });
});

test("lz-string links from before the compact format still open", () => {
  const raw = LZString.compressToEncodedURIComponent(JSON.stringify({ ...state, modelVersion: MODEL_VERSION }));
  assert.deepEqual(decodeShareState(raw), { ...state, modelVersion: MODEL_VERSION });
});
