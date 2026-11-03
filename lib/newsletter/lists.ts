/**
 * Custom recipient lists: reading an uploaded CSV into contacts.
 *
 * Forgiving about the file — comma, semicolon or tab; a header row or none;
 * "Email", "E-mail address", "Full name", "First name" + "Last name",
 * "Language" — and strict about what comes out: lower-cased, well-formed
 * addresses, one per list, every rejected line reported with why. Pure; the
 * upload screen runs it in the browser for the preview, and the import action
 * runs it again on the server, which is the one that counts.
 */

export const LIST_IMPORT_MAX = 20_000;

export type ContactInput = { email: string; name: string; locale: "en" | "ar" };

export type ParsedContacts = {
  contacts: ContactInput[];
  invalid: { line: number; value: string; reason: string }[];
  /** Lines whose address was already earlier in the file. */
  duplicates: number;
  /** Lines past LIST_IMPORT_MAX, not read. */
  truncated: number;
  /** What each column was taken to be, for the preview. */
  columns: { email: number; name: number | null; first: number | null; last: number | null; language: number | null; header: boolean };
};

const EMAIL = /^[^@\s"'<>,;]+@[^@\s"'<>,;]+\.[a-z]{2,}$/i;

export function normaliseEmail(raw: string): string {
  return raw.trim().replace(/^mailto:/i, "").replace(/^<|>$/g, "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email);
}

/** Arabic for "ar", "arabic", "عربي", "العربية"; English otherwise. */
export function localeOf(raw: string | undefined): "en" | "ar" {
  const v = (raw ?? "").trim().toLowerCase();
  return /^(ar|arabic|ar-[a-z]+|عربي|العربية)$/.test(v) ? "ar" : "en";
}

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]![0];
}

/** RFC 4180-ish rows: quoted fields may hold the delimiter, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADERS = {
  email: /^(e-?mail|e-?mail address|email_address|address|mail)$/,
  name: /^(name|full ?name|full_name|contact|contact name|الاسم)$/,
  first: /^(first ?name|first_name|given name|firstname)$/,
  last: /^(last ?name|last_name|surname|family name|lastname)$/,
  language: /^(language|lang|locale|preferred language|اللغة)$/,
};

/** A CSV's text → contacts, with every line that couldn't be used and why. */
export function parseContacts(text: string): ParsedContacts {
  const rows = parseCsv(text);
  const head = (rows[0] ?? []).map((c) => c.trim().toLowerCase());
  const find = (re: RegExp) => {
    const i = head.findIndex((h) => re.test(h));
    return i === -1 ? null : i;
  };
  const headerEmail = find(HEADERS.email);
  const header = headerEmail !== null;
  let columns: ParsedContacts["columns"];
  if (header) {
    columns = {
      email: headerEmail,
      name: find(HEADERS.name),
      first: find(HEADERS.first),
      last: find(HEADERS.last),
      language: find(HEADERS.language),
      header: true,
    };
  } else {
    // No header: the address is whichever column holds one; the name, the first other column.
    const sample = rows.slice(0, 20);
    const width = Math.max(0, ...sample.map((r) => r.length));
    let email = 0;
    for (let c = 0; c < width; c++) {
      if (sample.filter((r) => (r[c] ?? "").includes("@")).length > sample.length / 2) {
        email = c;
        break;
      }
    }
    const other = Array.from({ length: width }, (_, c) => c).find((c) => c !== email);
    columns = { email, name: other ?? null, first: null, last: null, language: null, header: false };
  }

  const body = header ? rows.slice(1) : rows;
  const offset = header ? 2 : 1;
  const seen = new Set<string>();
  const out: ParsedContacts = { contacts: [], invalid: [], duplicates: 0, truncated: 0, columns };
  body.forEach((r, i) => {
    const line = i + offset;
    const raw = r[columns.email] ?? "";
    const email = normaliseEmail(raw);
    if (!email) {
      out.invalid.push({ line, value: r.join(", ").slice(0, 80), reason: "No email address" });
      return;
    }
    if (!isValidEmail(email)) {
      out.invalid.push({ line, value: raw.trim().slice(0, 80), reason: "Not an email address" });
      return;
    }
    if (seen.has(email)) {
      out.duplicates += 1;
      return;
    }
    if (out.contacts.length >= LIST_IMPORT_MAX) {
      out.truncated += 1;
      return;
    }
    seen.add(email);
    const name =
      columns.name !== null
        ? (r[columns.name] ?? "")
        : [columns.first !== null ? r[columns.first] : "", columns.last !== null ? r[columns.last] : ""].filter(Boolean).join(" ");
    out.contacts.push({
      email,
      name: name.replace(/\s+/g, " ").trim().slice(0, 120),
      locale: localeOf(columns.language !== null ? r[columns.language] : undefined),
    });
  });
  return out;
}

/** The contacts back out as a CSV, for "Download list". Formula-leading cells are quoted against spreadsheet injection. */
export function contactsToCsv(rows: { email: string; name: string; locale: string; status: string; created_at: string }[]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return ["name,email,language,status,added", ...rows.map((r) => [r.name, r.email, r.locale, r.status, r.created_at.slice(0, 10)].map(cell).join(","))].join("\n");
}
