"use client";

import { useState, useSyncExternalStore } from "react";
import { ExchangeIllustration, StepIcon } from "@/components/illustrations";

const DONE_KEY = "meya:intro-done";

const SLIDES = [
  {
    art: "exchange" as const,
    title: "Bienvenue sur MEYA",
    text: "Changez vos euros et vos francs CFA directement avec d'autres particuliers, au meilleur taux disponible, sans frais pendant le pilote.",
  },
  {
    art: "match" as const,
    title: "Vous voyez tout avant de vous engager",
    text: "Indiquez combien vous envoyez : MEYA affiche ce que vous recevez et trouve un ou plusieurs partenaires. Vous n'échangez jamais à un taux moins bon que celui affiché.",
  },
  {
    art: "shield" as const,
    title: "Vous vous payez, MEYA vous guide",
    text: "L'argent ne passe pas par MEYA : vous payez directement votre partenaire. Celui qui a accepté l'offre paie en premier, chacun confirme chaque étape, et vous pouvez signaler un problème à tout moment.",
  },
];

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return true; // Stockage indisponible : on n'impose pas l'introduction à chaque visite.
  }
}

const subscribe = () => () => {};

/** Trois écrans de présentation au premier lancement de l'espace connecté. */
export function Intro() {
  const seen = useSyncExternalStore(subscribe, alreadySeen, () => true);
  const [closed, setClosed] = useState(false);
  const [index, setIndex] = useState(0);
  if (seen || closed) return null;

  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  function finish() {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // Navigation privée : l'introduction réapparaîtra à la prochaine visite.
    }
    setClosed(true);
  }

  return (
    <div className="intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro">
        <div className="intro-art">
          {slide.art === "exchange" ? <ExchangeIllustration size={150} /> : <span className="intro-icon"><StepIcon name={slide.art} /></span>}
        </div>
        <h2 id="intro-title">{slide.title}</h2>
        <p>{slide.text}</p>
        <div className="intro-dots" aria-label={`Écran ${index + 1} sur ${SLIDES.length}`}>
          {SLIDES.map((s, i) => <span key={s.title} className={i === index ? "on" : undefined} />)}
        </div>
        <div className="intro-actions">
          <button type="button" className="link-btn" onClick={finish}>Passer</button>
          <button type="button" className="btn btn-primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
            {last ? "Commencer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
