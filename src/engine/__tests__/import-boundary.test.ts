import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Import-boundary tests (Task 5.2, boundary half).
 *
 * Statically scans the source under `app/` and `src/` and asserts that the
 * `playcanvas` engine is imported ONLY from inside `src/engine`. App_Framework
 * code (`app/`) reaches the engine solely through the Engine_Mount and never
 * imports `playcanvas` directly. Test files and `src/engine` itself are
 * excluded from the "must not import" scan.
 *
 * _Requirements: 7.4, 7.5, 12.5_
 */

const ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "src"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs"];

/** True for files that are tests (excluded from the boundary scan). */
function isTestFile(absPath: string): boolean {
  const parts = absPath.split(sep);
  if (parts.includes("__tests__")) return true;
  const base = parts[parts.length - 1];
  return /\.(test|spec)\./.test(base);
}

/** True when a path is inside the engine system directory `src/engine`. */
function isInEngine(absPath: string): boolean {
  const rel = relative(ROOT, absPath).split(sep).join("/");
  return rel === "src/engine" || rel.startsWith("src/engine/");
}

function isSourceFile(absPath: string): boolean {
  return SOURCE_EXTENSIONS.some((ext) => absPath.endsWith(ext));
}

/** Recursively collect source files under a directory. */
function collectFiles(dir: string): string[] {
  let entries: string[] = [];
  let dirents;
  try {
    dirents = readdirSync(dir);
  } catch {
    return entries;
  }
  for (const name of dirents) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      entries = entries.concat(collectFiles(full));
    } else if (isSourceFile(full)) {
      entries.push(full);
    }
  }
  return entries;
}

/** Detects a static/dynamic import or require of the `playcanvas` module. */
function importsPlaycanvas(contents: string): boolean {
  const patterns = [
    /import\s[^;]*?from\s*["']playcanvas["']/s, // import ... from "playcanvas"
    /import\s*["']playcanvas["']/, // bare import "playcanvas"
    /import\s*\(\s*["']playcanvas["']\s*\)/, // dynamic import("playcanvas")
    /require\s*\(\s*["']playcanvas["']\s*\)/, // require("playcanvas")
  ];
  return patterns.some((re) => re.test(contents));
}

const allSourceFiles = SOURCE_ROOTS.flatMap((root) =>
  collectFiles(join(ROOT, root)),
);

describe("playcanvas import boundary", () => {
  it("finds source files to scan (sanity check)", () => {
    expect(allSourceFiles.length).toBeGreaterThan(0);
  });

  it("imports playcanvas only from within src/engine", () => {
    const offenders = allSourceFiles
      .filter((file) => !isInEngine(file) && !isTestFile(file))
      .filter((file) => importsPlaycanvas(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).split(sep).join("/"));

    expect(
      offenders,
      `playcanvas may only be imported inside src/engine, found: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("App_Framework (app/) never imports playcanvas directly", () => {
    const appOffenders = collectFiles(join(ROOT, "app"))
      .filter((file) => !isTestFile(file))
      .filter((file) => importsPlaycanvas(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file).split(sep).join("/"));

    expect(appOffenders).toEqual([]);
  });

  it("the engine system actually does import playcanvas (positive control)", () => {
    const engineFiles = collectFiles(join(ROOT, "src", "engine")).filter(
      (file) => !isTestFile(file),
    );
    const engineImporters = engineFiles.filter((file) =>
      importsPlaycanvas(readFileSync(file, "utf8")),
    );
    expect(engineImporters.length).toBeGreaterThan(0);
  });
});
