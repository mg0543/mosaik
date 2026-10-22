"use client";

import { useEffect } from "react";
import { markAllReadAction } from "./actions";

/** Une fois la liste affichée, les notifications sont marquées comme lues. */
export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markAllReadAction();
  }, [unread]);
  return null;
}
