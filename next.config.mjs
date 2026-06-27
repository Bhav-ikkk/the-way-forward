/**
 * Next.js configuration (App Router).
 *
 * The Render_Engine (PlayCanvas) is loaded exclusively on the client through a
 * dynamically imported, client-only Engine_Mount (`next/dynamic` with
 * `{ ssr: false }`). No server-side configuration is required to guard the
 * browser-only globals because the engine module is never imported on the
 * server. See docs/ARCHITECTURE.md for the integration boundary.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // The Render_Engine (PlayCanvas) is an imperative WebGL library whose setup
  // creates a GPU context and kicks off async asset loads. React StrictMode's
  // dev-only double-invoke would mount → tear down → remount the engine, and
  // in-flight GLB/texture loads from the discarded first instance land on a
  // torn-down asset loader (causing "No resource handler for asset type"
  // errors and a half-initialized scene). Production never double-mounts, so
  // disabling StrictMode here only affects the dev double-invoke and keeps the
  // engine lifecycle clean. See docs/ARCHITECTURE.md.
  reactStrictMode: false,
};

export default nextConfig;
