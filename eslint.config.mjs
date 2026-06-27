// ESLint flat configuration for the Portfolio World Engine.
//
// Next.js 14.2 ships `eslint-config-next` as a classic (eslintrc-style) shareable
// config, so it is bridged into this flat config via `FlatCompat`. The rules
// enforce the TypeScript/Next.js standards documented in docs/CODING_STANDARDS.md:
// the Next.js core-web-vitals + TypeScript rule sets, a small set of project
// conventions, and `eslint-config-prettier` last so formatting is owned by
// Prettier (.prettierrc) and never fought over by lint rules.
//
// `npm run lint` runs ESLint against this file (flat config is enabled via the
// ESLINT_USE_FLAT_CONFIG env var set in the package.json `lint` script, because
// the pinned ESLint 8.57.x line uses eslintrc by default).

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  // Paths that should never be linted.
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "assets/**", // Asset_Library: third-party files, referenced only.
    ],
  },

  // Next.js recommended rules (core-web-vitals) plus the Next.js TypeScript rules.
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Project conventions layered on top of the Next.js defaults.
  {
    rules: {
      // Prefer explicit, intentional code over silent dead values.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow `any` only deliberately; warn rather than error to avoid blocking.
      "@typescript-eslint/no-explicit-any": "warn",
      // Module-boundary hygiene: prefer `import type` for type-only imports.
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
    },
  },

  // Turn off all rules that conflict with Prettier formatting. Must come last.
  prettier,
];

export default config;
