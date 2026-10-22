import type { ReactNode } from "react";

/** Mention à compléter par l'éditeur ou un juriste : visible, jamais inventée. */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="todo">[À compléter : {children}]</mark>;
}

/** Bandeau des documents juridiques non encore validés. */
export function DraftNotice() {
  return (
    <div className="notice warn" role="note">
      <div>
        <strong>Version provisoire.</strong> Ce document décrit fidèlement le fonctionnement actuel de
        MEYA ; il doit être complété et validé par un juriste avant l&apos;ouverture du pilote.
      </div>
    </div>
  );
}
