import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeShareState, encodeShareState, isStaleModel } from "../shareState";
import { MODEL_VERSION } from "../model";
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
