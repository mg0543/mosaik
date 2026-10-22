import Link from "next/link";

/** Cloche des notifications, avec le nombre de non lues. */
export function Bell({ unread }: { unread: number }) {
  return (
    <Link href="/app/notifications" className="bell"
      aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && <span className="bell-badge num">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}
