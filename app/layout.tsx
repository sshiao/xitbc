import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XitBC · X in the Big City",
  description: "Put anyone in the big city: XitBC turns a photo into a short cinematic film with Claude, FLUX.2, MiniMax H3 and Sonilo on the Comfy Developer Platform.",
};

export const viewport: Viewport = { themeColor: "#090b1a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
