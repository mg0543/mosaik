"use client";

import { useSyncExternalStore } from "react";
import { fmtDate } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Date affichée dans le fuseau horaire de l'appareil (Paris, Dakar, Abidjan…).
 * Le rendu serveur, qui ne connaît pas ce fuseau, affiche l'heure UTC le temps du chargement.
 */
export function LocalDate({ date }: { date: Date }) {
  const timeZone = useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
  return <time dateTime={date.toISOString()}>{fmtDate(date, timeZone)}</time>;
}
