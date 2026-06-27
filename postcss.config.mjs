/**
 * PostCSS configuration consumed by Next.js to process TailwindCSS and
 * autoprefixer for the App_Framework global stylesheet.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
