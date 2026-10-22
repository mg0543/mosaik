import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Splash } from "@/components/splash";
import "./globals.css";
import "./app.css";
import "./meya.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MEYA · Échange EUR ↔ XOF entre particuliers", template: "%s · MEYA" },
  description: "Échangez vos euros et vos francs CFA avec d'autres particuliers, chacun à son prix. Pilote.",
  applicationName: "MEYA",
  appleWebApp: { capable: true, title: "MEYA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d1b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <Splash />
        {children}
      </body>
    </html>
  );
}
