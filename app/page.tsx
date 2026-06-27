import dynamic from "next/dynamic";

/**
 * Home route — a Server Component.
 *
 * The Engine_Mount is imported with `next/dynamic(..., { ssr: false })` so the
 * Render_Engine (PlayCanvas) and its browser-only globals are never imported or
 * executed on the server. The client initializes a Render_Engine instance on
 * load when this mount renders. See design.md "App_Framework boundary".
 */
const EngineMount = dynamic(
  () => import("../src/engine/EngineMount").then((m) => m.EngineMount),
  { ssr: false },
);

export default function Page() {
  return (
    <main>
      <EngineMount />
    </main>
  );
}
