import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadPortfolio } from "../src/data/loader";
import { dataFileSchemas, type DataFileName } from "../src/data/schema";

/**
 * Fixture test (Task 6.2): every shipped Demo_Developer example file in
 * `content/` validates against its schema via the Data_Loader.
 * _Requirements: 3.3_
 */

const CONTENT_DIR = join(process.cwd(), "content");
const fileNames = Object.keys(dataFileSchemas) as DataFileName[];

function readContent(name: DataFileName): unknown {
  const raw = readFileSync(join(CONTENT_DIR, `${name}.json`), "utf-8");
  return JSON.parse(raw);
}

describe("shipped Demo_Developer content fixtures", () => {
  it("loads the full content/ portfolio without validation errors", () => {
    const files = {} as Record<DataFileName, unknown>;
    for (const name of fileNames) {
      files[name] = readContent(name);
    }

    const result = loadPortfolio(files);
    if (!result.ok) {
      // Surface the offending fields to make a failure actionable.
      throw new Error(
        `content/ failed validation:\n${result.errors
          .map((e) => `  - [${e.file}] ${e.field}: ${e.message}`)
          .join("\n")}`,
      );
    }
    expect(result.ok).toBe(true);
  });

  it.each(fileNames)("validates content/%s.json against its schema", (name) => {
    const result = dataFileSchemas[name].safeParse(readContent(name));
    expect(result.success).toBe(true);
  });
});
