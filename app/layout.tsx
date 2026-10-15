import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ReactNode } from "react";
import ConvexClientProvider from "./ConvexClientProvider";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "NyayaSetu — Indian Legal Intelligence",
  description:
    "Plain-language legal help for citizens, verified advocates near your court, and a citation-verified research copilot for lawyers.",
};

export const viewport: Viewport = { themeColor: "#13305c", width: "device-width", initialScale: 1 };

// The app is Convex-client driven; render dynamically so the production build never fails during
// static prerendering (removes an entire class of Vercel build-time failures).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
