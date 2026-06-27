import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest configuration for the Portfolio World Engine.
 *
 * The data-layer logic (Data_Schema, Data_Loader, Asset_Index) is pure and runs
 * in a Node environment — no DOM is required. Engine/DOM-dependent tests (later
 * specs) can opt into a jsdom/happy-dom environment per-file via the
 * `// @vitest-environment` directive; the project default stays Node.
 */
export default defineConfig({
  // Use the automatic JSX runtime so client components (e.g. EngineMount.tsx)
  // that rely on Next.js's automatic runtime — and therefore do not import
  // React explicitly — transform correctly under the test runner.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});
