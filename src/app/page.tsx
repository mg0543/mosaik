import { Simulator } from "./simulator";

export default function Home() {
  return (
    <>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Simulateur de matching EUR ↔ XOF</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Prototype. Aucun argent n&apos;est déplacé : l&apos;outil calcule seulement comment une demande
        pourrait être servie par plusieurs offres.
      </p>
      <Simulator />
    </>
  );
}
