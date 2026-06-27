import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { loadPortfolio } from "../loader";
import {
  datasetArb,
  mutationArb,
  applyMutation,
  toRawFiles,
} from "./arbitraries";

const NUM_RUNS = 200; // minimum 100 iterations required by the design

describe("Data_Loader properties", () => {
  // Feature: portfolio-world-engine, Property 1: Schema-conforming data
  // round-trips through the loader — for any dataset generated to conform to
  // the Data_Schema, serializing it to JSON and loading it through the
  // Data_Loader succeeds and exposes parsed content equal to the original
  // (load(serialize(x)) == x).
  // Validates: Requirements 3.1, 3.3, 4.2, 12.1
  it("Property 1: schema-conforming data round-trips through the loader", () => {
    fc.assert(
      fc.property(datasetArb, (dataset) => {
        const raw = toRawFiles(dataset);
        const result = loadPortfolio(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.portfolio).toEqual(dataset);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: portfolio-world-engine, Property 2: Any single schema violation
  // produces a descriptive, located error — for any schema-conforming dataset
  // with exactly one mutation applied (drop a required field OR replace a
  // field with a wrong-type value), the loader fails validation and returns a
  // descriptive error naming both the offending field and the source file.
  // Validates: Requirements 4.3, 4.4
  it("Property 2: any single schema violation produces a descriptive, located error", () => {
    fc.assert(
      fc.property(datasetArb, mutationArb, (dataset, mutation) => {
        const mutated = applyMutation(dataset, mutation);
        const result = loadPortfolio(toRawFiles(mutated));

        // The single mutation must make the load fail.
        expect(result.ok).toBe(false);
        if (result.ok) return;

        // Some returned error must name BOTH the offending field and the
        // source Data_File, and carry a non-empty descriptive message.
        const located = result.errors.find(
          (e) =>
            e.file === mutation.ref.file &&
            e.field.includes(mutation.ref.field),
        );
        expect(located).toBeDefined();
        expect(located?.message).toContain(mutation.ref.file);
        expect(located?.message.length).toBeGreaterThan(0);
        // The error kind reflects the mutation applied.
        const expectedKind =
          mutation.kind === "drop" ? "missing_required" : "type_mismatch";
        expect(located?.kind).toBe(expectedKind);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
