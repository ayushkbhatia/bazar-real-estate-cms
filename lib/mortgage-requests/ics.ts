/**
 * The calendar invite a booked consultation's email carries (C6: "invite by
 * email … with an .ics"). RFC 5545, METHOD:PUBLISH — the file adds the event
 * to the applicant's calendar without asking them to reply to anyone.
 */

function stamp(value: string | Date): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Commas, semicolons, backslashes and newlines are escaped (RFC 5545 §3.3.11). */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const next = current + ch;
    if (new TextEncoder().encode(next).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

export function consultationIcs(input: {
  uid: string;
  startsAt: string;
  endsAt: string;
  summary: string;
  description: string;
  location: string;
  now?: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bazar Real Estate//Mortgages//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@bazarrealestate.ae`,
    `DTSTAMP:${stamp(input.now ?? new Date())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(input.endsAt)}`,
    `SUMMARY:${text(input.summary)}`,
    `DESCRIPTION:${text(input.description)}`,
    `LOCATION:${text(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
