"use client";

import { useSyncExternalStore, useState } from "react";

const DISMISS_KEY = "mosaik:install-hint-dismissed";

/** Sur iPhone, Safari n'affiche pas de bouton d'installation : on explique la marche à suivre. */
function shouldShow(): boolean {
  try {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return ios && !standalone && localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

export function InstallHint() {
  const eligible = useSyncExternalStore(subscribe, shouldShow, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on masque seulement pour cette visite.
    }
    setDismissed(true);
  }

  return (
    <div className="notice info install-hint" role="note">
      <div>
        <strong>Installer Mosaik sur votre iPhone :</strong> touchez le bouton Partager de Safari,
        puis « Sur l&apos;écran d&apos;accueil ».
      </div>
      <button type="button" className="link-btn" onClick={dismiss}>Fermer</button>
    </div>
  );
}
