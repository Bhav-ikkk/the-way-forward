import type { Config } from "tailwindcss";

/**
 * TailwindCSS configuration for the Portfolio World Engine App_Framework.
 * Content globs cover the App Router entry and the source systems so that
 * utility classes used in any component are retained in the build.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
