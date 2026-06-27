import { describe, it, expect } from "vitest";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Smoke tests for project structure and version pinning (Task 1.2).
 *
 * Asserts the required top-level directories exist, that each named system
 * (engine, data, assets, scene) has its own directory, that `package.json`
 * pins EXACT versions (no `^`/`~` range prefixes) for the core dependencies,
 * and that a `package-lock.json` lockfile is present.
 *
 * _Requirements: 1.1, 1.5, 8.1, 8.2_
 */

const ROOT = process.cwd();

function isDir(relPath: string): boolean {
  const full = resolve(ROOT, relPath);
  return existsSync(full) && statSync(full).isDirectory();
}

describe("project structure", () => {
  // Required top-level directories (design.md "Folder Structure").
  const REQUIRED_DIRS = [
    "app",
    "src",
    "content",
    "docs",
    "assets",
  ];

  it.each(REQUIRED_DIRS)("has the required directory %s", (dir) => {
    expect(isDir(dir)).toBe(true);
  });

  // Each named system has its own directory under src/ (Requirement 1.1, 1.5).
  const NAMED_SYSTEM_DIRS = [
    "src/engine",
    "src/data",
    "src/assets",
    "src/scene",
  ];

  it.each(NAMED_SYSTEM_DIRS)("gives the named system %s its own directory", (dir) => {
    expect(isDir(dir)).toBe(true);
  });

  it("gives the Data_Schema its own directory under src/data", () => {
    expect(isDir("src/data/schema")).toBe(true);
  });
});

describe("version pinning (Version_Manifest)", () => {
  const pkgRaw = readFileSync(resolve(ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  /** A version string is exact when it has no range prefix and is concrete. */
  function isExactVersion(version: string): boolean {
    // Reject npm range prefixes/operators and wildcards.
    if (/[\^~]/.test(version)) return false;
    if (/[*x]/i.test(version)) return false;
    if (/\s|\|\||\s-\s|>|</.test(version)) return false;
    // Require a concrete semver-like x.y.z.
    return /^\d+\.\d+\.\d+/.test(version);
  }

  const PINNED_DEPS = [
    "next",
    "react",
    "typescript",
    "tailwindcss",
    "playcanvas",
  ];

  it.each(PINNED_DEPS)("pins an exact version for %s", (name) => {
    const version = allDeps[name];
    expect(version, `${name} should be declared in package.json`).toBeDefined();
    expect(
      isExactVersion(version),
      `${name} version "${version}" must be exact (no ^ or ~ range prefix)`,
    ).toBe(true);
  });

  it("present a package-lock.json lockfile", () => {
    expect(existsSync(resolve(ROOT, "package-lock.json"))).toBe(true);
  });
});
