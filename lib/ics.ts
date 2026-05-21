/**
 * Tiny iCalendar (.ics) generator. No external dependency — RFC 5545
 * compliant enough for Google Calendar / Apple Calendar / Outlook to
 * round-trip cleanly.
 */

export type IcsEvent = {
  /** Stable identifier — typically the viewing id, prefixed with the org. */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** Event start (UTC). */
  startsAt: Date;
  /** Event end (UTC). */
  endsAt: Date;
  /** Calendar method — REQUEST creates a calendar invite. */
  method?: "REQUEST" | "PUBLISH" | "CANCEL";
  /** Organizer mailbox + display name. */
  organizer?: { name: string; email: string };
  /** Optional attendee mailbox + display name. */
  attendee?: { name?: string; email: string };
};

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Format a Date as UTC YYYYMMDDTHHMMSSZ. */
export function formatIcsDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escape text per RFC 5545 (commas, semicolons, backslashes, newlines). */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a long line every 75 octets per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let s = line;
  while (s.length > 75) {
    out.push(s.slice(0, 75));
    s = s.slice(75);
  }
  out.push(s);
  return out.join("\r\n ");
}

export function buildIcs(event: IcsEvent): string {
  const now = formatIcsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bazar Real Estate//EN",
    `METHOD:${event.method ?? "PUBLISH"}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(event.startsAt)}`,
    `DTEND:${formatIcsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.description)
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.organizer) {
    const n = escapeIcsText(event.organizer.name);
    lines.push(`ORGANIZER;CN=${n}:mailto:${event.organizer.email}`);
  }
  if (event.attendee) {
    const n = event.attendee.name
      ? `;CN=${escapeIcsText(event.attendee.name)}`
      : "";
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION${n}:mailto:${event.attendee.email}`,
    );
  }
  lines.push("STATUS:TENTATIVE");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.map(fold).join("\r\n");
}
