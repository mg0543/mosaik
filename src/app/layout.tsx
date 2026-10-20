import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Liquidité EUR ↔ XOF (prototype)",
  description: "Prototype de moteur de matching de liquidité multi-devises.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f7f7f5", color: "#1a1a1a" }}>
        <main style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>{children}</main>
      </body>
    </html>
  );
}
