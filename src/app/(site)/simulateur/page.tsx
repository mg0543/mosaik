import { Simulator } from "./simulator";

export const metadata = { title: "Simulateur · MEYA" };

export default function SimulatorPage() {
  return (
    <>
      <section className="intro">
        <h1>Simulateur de matching EUR ↔ XOF</h1>
        <p>
          Une demande est servie par plusieurs vendeurs, chacun à son propre taux. Les offres
          partiellement consommées gardent leur reste dans le carnet.
        </p>
      </section>
      <Simulator />
      <p className="disclaimer">
        Prototype de démonstration. Aucun argent n&apos;est déplacé, aucun paiement n&apos;est
        effectué. Les vendeurs et les montants affichés sont fictifs.
      </p>
    </>
  );
}
