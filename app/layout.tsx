import type { Metadata } from "next";

import "./globals.css";

/**
 * Root layout — a Server Component providing the html/body shell and metadata.
 *
 * It imports the global stylesheet and renders page content into the body. No
 * engine code is imported here; the Render_Engine is reached only through the
 * client-only Engine_Mount dynamically imported in app/page.tsx.
 */
export const metadata: Metadata = {
  title: "Portfolio World Engine",
  description:
    "An open-source, data-driven interactive 3D developer portfolio world built on Next.js and the PlayCanvas engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
