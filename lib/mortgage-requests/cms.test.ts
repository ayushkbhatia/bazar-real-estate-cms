import { describe, expect, it } from "vitest";
import {
  ageOn,
  describeUserAgent,
  formatActivityTime,
  formatBookedAt,
  formatBytes,
  formatCallDuration,
  formatLongDate,
  formatWeekdayDate,
  formatWhen,
  initialsOf,
  maskIp,
  receivedParts,
} from "./cms-format";
import { buildActivity, describeEvent } from "./activity";
import { consultationIcs } from "./ics";
import {
  DEFAULT_QUEUE_PARAMS,
  inTab,
  matchesSearch,
  parseQueueParams,
  promiseDueCompare,
  queueQuery,
  type Orderable,
} from "./queue";
import { nextWorkingDays, slotsForDay, windowsFromAdviserHours, windowsFromSetting } from "./slots";
import { DEFAULT_WORKING_HOURS, type SlaStatus } from "./sla";
import { CMS_MESSAGES, cmsT, PENDING_CMS_COPY } from "./cms-strings";

// Tue 22 Sep 2026, 16:30 in Dubai.
const NOW = new Date("2026-09-22T12:30:00Z");

describe("CMS formatting (cms/00-foundations §9)", () => {
  it("prints C1's Received column", () => {
    expect(receivedParts("2026-09-22T06:14:00Z", NOW)).toEqual({ kind: "today", time: "10:14" });
    expect(receivedParts("2026-09-21T14:20:00Z", NOW)).toEqual({ kind: "other", text: "Mon 18:20" });
    expect(receivedParts("2026-09-10T08:00:00Z", NOW)).toEqual({ kind: "other", text: "10 Sep" });
    expect(formatActivityTime("2026-09-22T12:21:00Z", NOW)).toBe("16:21");
  });

  it("prints C6's header times", () => {
    expect(formatWhen("2026-09-22T05:47:00Z", NOW)).toBe("today 09:47");
    expect(formatWhen("2026-09-21T14:20:00Z", NOW)).toBe("yesterday 18:20");
  });

  it("prints dates of birth and ages as C2 and C6 do", () => {
    expect(formatLongDate("1990-03-14")).toBe("14 Mar 1990");
    expect(formatLongDate("1986-11-02")).toBe("02 Nov 1986");
    expect(ageOn("1990-03-14", NOW)).toBe(36);
    expect(ageOn("1986-11-02", NOW)).toBe(39);
    // Birthday today counts.
    expect(ageOn("2000-09-22", NOW)).toBe(26);
  });

  it("masks the consent's IP and names its browser", () => {
    expect(maskIp("94.203.12.7")).toBe("94.203.•.•");
    expect(maskIp("2001:db8::1")).toBe("2001:db8:•");
    expect(describeUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    )).toEqual({ browser: "Chrome", os: "macOS" });
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1")).toEqual({
      browser: "Safari",
      os: "iOS",
    });
  });

  it("prints sizes, call lengths, initials, days and bookings", () => {
    expect(formatBytes(412 * 1024)).toBe("412 KB");
    expect(formatBytes(Math.round(1.5 * 1_048_576))).toBe("1.5 MB");
    expect(formatCallDuration(32)).toBe("0:32");
    expect(initialsOf("Yasmin Abdalla")).toBe("YA");
    expect(initialsOf("Leena")).toBe("LE");
    expect(formatWeekdayDate("2026-09-23T06:00:00Z")).toBe("Wed 23 Sep");
    expect(formatBookedAt("2026-09-23T07:30:00Z")).toBe("Wed 23 Sep · 11:30");
  });
});

const clock = (state: SlaStatus["state"], remainingSeconds: number): SlaStatus => ({
  state,
  stopped: false,
  remainingSeconds,
  elapsedSeconds: 86400 - remainingSeconds,
  dueAt: null,
  pct: 0,
});

const row = (o: Partial<Orderable>): Orderable => ({
  service: "pre_approval",
  status: "in_review",
  submittedAt: "2026-09-22T06:00:00Z",
  sla: null,
  bookedAt: null,
  lastContactAt: null,
  ...o,
});

describe("the promise-due order (SPEC §4.3)", () => {
  it("puts pre-approvals first, least time left first, paused by their frozen time", () => {
    const rows = [
      row({ submittedAt: "a", sla: clock("running", 63_720) }), // 17h 42m
      row({ submittedAt: "b", sla: clock("paused", 33_180) }), // 9h 13m, paused
      row({ submittedAt: "c", sla: clock("at_risk", 6_480) }), // 1h 48m
      row({ service: "consultancy", status: "new", submittedAt: "d" }),
      row({ submittedAt: "e", sla: clock("breached", -600) }),
    ];
    expect([...rows].sort(promiseDueCompare).map((r) => r.submittedAt)).toEqual(["e", "c", "b", "a", "d"]);
  });

  it("orders consultancy New by longest waiting, then Contacted, then Booked by appointment", () => {
    const rows = [
      row({ service: "consultancy", status: "consultation_booked", bookedAt: "2026-09-24T06:00:00Z", submittedAt: "booked-later" }),
      row({ service: "consultancy", status: "contacted", lastContactAt: "2026-09-22T07:20:00Z", submittedAt: "contacted" }),
      row({ service: "consultancy", status: "new", submittedAt: "2026-09-22T12:00:00Z" }),
      row({ service: "consultancy", status: "consultation_booked", bookedAt: "2026-09-23T07:30:00Z", submittedAt: "booked-sooner" }),
      row({ service: "consultancy", status: "new", submittedAt: "2026-09-22T08:00:00Z" }),
    ];
    expect([...rows].sort(promiseDueCompare).map((r) => r.submittedAt)).toEqual([
      "2026-09-22T08:00:00Z",
      "2026-09-22T12:00:00Z",
      "contacted",
      "booked-sooner",
      "booked-later",
    ]);
  });

  it("files statuses under the designed tabs", () => {
    expect(inTab("awaiting_applicant", "awaiting")).toBe(true);
    expect(inTab("consultation_booked", "contacted_booked")).toBe(true);
    expect(inTab("completed", "open")).toBe(false);
    expect(inTab("completed", "closed")).toBe(true);
    expect(inTab("new", "open")).toBe(true);
  });

  it("searches name, reference with or without BZM-, and the mobile's last digits", () => {
    const r = { fullName: "Priya Raman", reference: "BZM-26-0412", mobile: "+971502184417" };
    expect(matchesSearch(r, "priya")).toBe(true);
    expect(matchesSearch(r, "BZM-26-0412")).toBe(true);
    expect(matchesSearch(r, "26-0412")).toBe(true);
    expect(matchesSearch(r, "0412")).toBe(true);
    expect(matchesSearch(r, "4417")).toBe(true);
    expect(matchesSearch(r, "441")).toBe(false);
    expect(matchesSearch(r, "karim")).toBe(false);
  });
});

describe("an adviser's slots (C6)", () => {
  const holidays = new Set<string>();
  const windows = windowsFromSetting(DEFAULT_WORKING_HOURS, 3); // Wednesday, 09:00–19:00

  it("offers a 30-minute grid of 20-minute meetings inside working hours", () => {
    const slots = slotsForDay({ day: "2026-09-23", windows, holidays, bookings: [], gridMinutes: 30, durationMinutes: 20, now: NOW });
    expect(slots[0]).toMatchObject({ time: "09:00", available: true, startsAt: "2026-09-23T05:00:00.000Z" });
    expect(slots.at(-1)!.time).toBe("18:30");
    expect(slots).toHaveLength(20);
  });

  it("marks slots that overlap a booking, and drops the past", () => {
    const bookings = [{ startsAt: "2026-09-23T06:30:00Z", endsAt: "2026-09-23T06:50:00Z" }]; // 10:30–10:50
    const slots = slotsForDay({ day: "2026-09-23", windows, holidays, bookings, gridMinutes: 30, durationMinutes: 20, now: NOW });
    expect(slots.find((s) => s.time === "10:30")?.available).toBe(false);
    expect(slots.find((s) => s.time === "10:00")?.available).toBe(true);
    expect(slots.find((s) => s.time === "11:00")?.available).toBe(true);
    const today = slotsForDay({ day: "2026-09-22", windows, holidays, bookings: [], gridMinutes: 30, durationMinutes: 20, now: NOW });
    expect(today[0]!.time).toBe("17:00");
  });

  it("gives nothing on a holiday, and uses an adviser's own hours when set", () => {
    expect(slotsForDay({ day: "2026-09-23", windows, holidays: new Set(["2026-09-23"]), bookings: [], gridMinutes: 30, durationMinutes: 20, now: NOW })).toEqual([]);
    const own = windowsFromAdviserHours([{ weekday: 3, starts: "09:00:00", ends: "12:00:00" }], 3)!;
    const slots = slotsForDay({ day: "2026-09-23", windows: own, holidays, bookings: [], gridMinutes: 30, durationMinutes: 20, now: NOW });
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(windowsFromAdviserHours([], 3)).toBeNull();
  });

  it("lists the next working days, skipping closed days and holidays", () => {
    // From Tue 22 Sep: Wed, Thu, Fri, then Sat is closed, Sun works.
    expect(nextWorkingDays({ from: NOW, count: 4, setting: DEFAULT_WORKING_HOURS, holidays })).toEqual([
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-27",
    ]);
    expect(nextWorkingDays({ from: NOW, count: 2, setting: DEFAULT_WORKING_HOURS, holidays: new Set(["2026-09-23"]) })).toEqual([
      "2026-09-24",
      "2026-09-25",
    ]);
  });
});

describe("the calendar invite", () => {
  it("is a valid VEVENT in UTC, escaped and folded", () => {
    const ics = consultationIcs({
      uid: "c-1",
      startsAt: "2026-09-23T06:00:00Z",
      endsAt: "2026-09-23T06:20:00Z",
      summary: "Mortgage consultation with Bazar",
      description: "Phone call with Rashid Khan, reference BZM-26-0415; we'll call +971 50 774 1290.",
      location: "Phone call",
      now: new Date("2026-09-22T07:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20260923T060000Z\r\n");
    expect(ics).toContain("DTEND:20260923T062000Z\r\n");
    expect(ics).toContain("UID:c-1@bazarrealestate.ae");
    expect(ics).toContain("Rashid Khan\\, reference BZM-26-0415\\;");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("the CMS copy", () => {
  it("formats the designed strings", () => {
    expect(cmsT("c1.breadcrumbs", { open: "31", new: "5" })).toBe("Inbox · 31 open · 5 new");
    expect(cmsT("c1.risk.title", { count: 2 })).toBe("2 pre-approvals are inside their last 4 hours.");
    expect(cmsT("c1.risk.title", { count: 1 })).toBe("1 pre-approval is inside its last 4 hours.");
    expect(cmsT("doc.tradeLicense")).toBe("Business trade licence");
    expect(cmsT("c6.ready.body", { firstName: "Ahmed", employment: "Salaried" })).not.toMatch(/\bhis\b|\bhe'll\b/i);
  });

  it("lists only keys it has as pending", () => {
    const keys = (obj: Record<string, unknown>, p = ""): string[] =>
      Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    const all = new Set(keys(CMS_MESSAGES as unknown as Record<string, unknown>));
    expect(PENDING_CMS_COPY.filter((k) => !all.has(k))).toEqual([]);
  });
});

describe("the queue's URL", () => {
  it("round-trips a view, leaving defaults out", () => {
    expect(queueQuery(DEFAULT_QUEUE_PARAMS)).toBe("");
    const view = { tab: "in_review", service: "pre_approval", owner: "unassigned", page: 2, risk: true } as const;
    expect(parseQueueParams(Object.fromEntries(new URLSearchParams(queueQuery(view).slice(1))))).toEqual(view);
  });

  it("falls back to the defaults for anything it doesn't know", () => {
    expect(parseQueueParams({ tab: "archived", service: "loans", owner: "robert'); drop", page: "-3", risk: "yes" })).toEqual(
      DEFAULT_QUEUE_PARAMS,
    );
    expect(parseQueueParams({ owner: "3f1c2a4e-9b7d-4c1e-8a2b-5d6e7f8a9b0c" }).owner).toBe("3f1c2a4e-9b7d-4c1e-8a2b-5d6e7f8a9b0c");
  });
});

describe("activity lines (00-foundations §11)", () => {
  const YASMIN = "11111111-1111-1111-1111-111111111111";
  const RASHID = "22222222-2222-2222-2222-222222222222";
  const ctx = {
    service: "pre_approval" as const,
    applicantName: "Ahmed Al Suwaidi",
    mobile: "+971507741290",
    names: new Map([
      [YASMIN, "Yasmin Abdalla"],
      [RASHID, "Rashid Khan"],
    ]),
    now: NOW,
  };
  const event = (type: string, data: Record<string, unknown> = {}, actor: string | null = YASMIN, at = "2026-09-22T12:21:00Z") => ({
    id: `${type}-${at}`,
    type,
    actor_kind: actor ? ("staff" as const) : ("system" as const),
    actor_id: actor,
    data,
    created_at: at,
  });

  it("words C2's designed lines", () => {
    const lines = buildActivity(
      [
        event("document.viewed", { kind: "salary_certificate" }),
        event("owner.assigned", { owner_staff_id: YASMIN, via: "round_robin" }, null, "2026-09-22T06:31:00Z"),
        event("request.submitted", {}, null, "2026-09-22T06:14:00Z"),
        // The first open's move to In review has its own line already.
        event("status.changed", { from: "new", to: "in_review", event: "first_document_opened" }),
        event("contact.logged", { channel: "call", outcome: "no_answer" }),
        event("file.scan_failed", {}),
      ],
      [],
      ctx,
    );
    expect(lines.map((l) => [l.time, l.text, l.sub ?? null])).toEqual([
      ["16:21", "Yasmin opened Salary certificate", null],
      ["10:31", "Assigned to Yasmin", "Round-robin · mortgage team"],
      ["10:14", "Submitted from the website", "Confirmation shown · email sent"],
    ]);
  });

  it("words C6's contact log, quoting what was said", () => {
    const lines = buildActivity(
      [event("request.submitted", {}, null, "2026-09-22T05:47:00Z")],
      [
        { id: "a", staff_id: null, channel: "whatsapp", outcome: "received", body: "Tomorrow morning works.", duration_seconds: null, occurred_at: "2026-09-22T07:20:00Z" },
        { id: "b", staff_id: RASHID, channel: "whatsapp", outcome: "sent", body: "Hi Ahmed", duration_seconds: null, occurred_at: "2026-09-22T06:54:00Z" },
        { id: "c", staff_id: RASHID, channel: "call", outcome: "no_answer", body: null, duration_seconds: 32, occurred_at: "2026-09-22T06:52:00Z" },
      ],
      { ...ctx, service: "consultancy" },
    );
    expect(lines.map((l) => [l.time, l.text, l.sub ?? null, !!l.strong, !!l.quote])).toEqual([
      ["11:20", "Ahmed replied on WhatsApp", "“Tomorrow morning works.”", true, true],
      ["10:54", "Rashid sent a WhatsApp", "“Hi Ahmed”", false, true],
      ["10:52", "Rashid called · no answer", "+971 50 774 1290 · 0:32", false, false],
      ["09:47", "Request received from the website", "Mortgage Consultancy · no documents", false, false],
    ]);
  });

  it("words the Phase 4 actions", () => {
    const [claim, reassign, booked, invite] = [
      describeEvent(event("owner.assigned", { owner_staff_id: RASHID, via: "claim" }, RASHID), ctx),
      describeEvent(event("owner.assigned", { owner_staff_id: RASHID, from: YASMIN, via: "reassign" }), ctx),
      describeEvent(event("consultation.booked", { starts_at: "2026-09-23T06:00:00Z", format: "phone", adviser_staff_id: RASHID }, RASHID), ctx),
      describeEvent(event("invite.sent", { expires_at: "2026-09-29T06:00:00Z" }, RASHID), ctx),
    ];
    expect(claim?.text).toBe("Rashid claimed this request");
    expect([reassign?.text, reassign?.sub]).toEqual(["Reassigned to Rashid", "by Yasmin"]);
    expect([booked?.text, booked?.sub]).toEqual(["Rashid booked Wed 23 Sep · 10:00", "Phone call with Rashid Khan"]);
    expect([invite?.text, invite?.sub]).toEqual(["Rashid sent a pre-approval link", "Expires 29 Sep"]);
  });

  it("words the Phase 5 review: the re-upload says itself, so its status changes stay quiet", () => {
    const lines = [
      describeEvent(event("reupload.requested", { kind: "bank_statements_12m", reason: "period_incomplete" }, YASMIN), ctx),
      describeEvent(event("reupload.fulfilled", { kind: "bank_statements_12m", files: 1, replaced: false }), ctx),
      describeEvent(event("reupload.cancelled", { kind: "passport" }, YASMIN), ctx),
      describeEvent(event("link.locked", { purpose: "reupload" }), ctx),
      describeEvent(event("invite.used", { reference: "BZM-26-0419" }), ctx),
      describeEvent(event("owner.assigned", { owner_staff_id: RASHID, via: "invite" }), ctx),
    ];
    expect(lines.map((l) => [l?.text, l?.sub ?? null])).toEqual([
      ["Yasmin asked for Last 1 year's bank statements again", "Period incomplete"],
      ["Ahmed sent Last 1 year's bank statements", "1 file"],
      ["Yasmin cancelled the request for Passport copy", null],
      ["The secure link locked after five wrong codes", null],
      ["Ahmed applied for Fast Pre-Approval", "BZM-26-0419"],
      ["Assigned to Rashid", "Sent the pre-approval link"],
    ]);
    for (const quiet of ["reupload_requested", "reupload_fulfilled", "reupload_cancelled"]) {
      expect(describeEvent(event("status.changed", { to: "in_review", event: quiet }), ctx)).toBeNull();
    }
  });

  it("words the Phase 6 bank steps, naming each bank as the team does", () => {
    const bank = (type: string, data: Record<string, unknown>) => ({ ...event(type, data, null), actor_kind: "bank" as const });
    const lines = [
      describeEvent(event("bank.package_sent", { banks: ["FAB", "ADCB", "MSQ"], labels: ["FAB", "ADCB", "Mashreq"], documents: 4 }, RASHID), ctx),
      describeEvent(bank("bank.package_opened", { bank: "MSQ", label: "Mashreq" }), ctx),
      describeEvent(bank("document.downloaded", { bank: "FAB", label: "FAB", kind: "passport" }), ctx),
      describeEvent(event("bank.reminder_sent", { bank: "ADCB", label: "ADCB" }, RASHID), ctx),
      describeEvent(event("bank.response_recorded", { bank: "FAB", label: "FAB", status: "pre_approved", amount: 2150000, letter: "FAB-letter.pdf" }, RASHID), ctx),
      describeEvent(event("bank.response_recorded", { bank: "ADCB", label: "ADCB", status: "declined" }, RASHID), ctx),
      describeEvent(event("decision.pre_approved", { bank: "FAB", label: "FAB", amount: 2150000 }, RASHID), ctx),
      // Before 0149 an event carried the code alone.
      describeEvent(bank("bank.package_opened", { bank: "ENBD" }), ctx),
      describeEvent(event("document.viewed", { file_id: "f", kind: "bank_letter" }), ctx),
    ];
    expect(lines.map((l) => [l?.text, l?.sub ?? null])).toEqual([
      ["Package sent to FAB, ADCB and Mashreq", "4 documents · structured summary"],
      ["Mashreq opened the package", null],
      ["FAB downloaded Passport copy", null],
      ["Reminder sent to ADCB", null],
      ["FAB pre-approved up to AED 2,150,000", "Letter attached · FAB-letter.pdf"],
      ["ADCB declined", null],
      ["Rashid sent the pre-approval", "FAB · up to AED 2,150,000"],
      ["ENBD opened the package", null],
      ["Yasmin opened a bank's letter", null],
    ]);
    for (const quiet of ["sent_to_banks", "pre_approved", "declined"]) {
      expect(describeEvent(event("status.changed", { to: "with_banks", event: quiet }), ctx)).toBeNull();
    }
  });
});
