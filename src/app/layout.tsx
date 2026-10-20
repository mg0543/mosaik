import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { REFERENCE_RATE } from "@/lib/matching";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Mosaik · Simulateur de matching EUR ↔ XOF",
  description: "Prototype de moteur de matching de liquidité EUR ↔ XOF. Aucun argent n'est déplacé.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <Logo />
              Mosaik
            </div>
            <span className="tag">Prototype · simulation sans argent réel</span>
            <div className="ref-rate">
              Taux de référence
              <strong className="num">
                1 EUR = {(REFERENCE_RATE / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} XOF
              </strong>
              · parité fixe
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}

/** Logo : une mosaïque de tuiles, comme une demande servie par plusieurs vendeurs. */
function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="0" y="0" width="15" height="11" rx="3" fill="var(--accent)" />
      <rect x="17" y="0" width="9" height="11" rx="3" fill="var(--accent)" opacity="0.6" />
      <rect x="0" y="13" width="8" height="13" rx="3" fill="var(--accent)" opacity="0.6" />
      <rect x="10" y="13" width="16" height="13" rx="3" fill="var(--accent)" opacity="0.85" />
    </svg>
  );
}
