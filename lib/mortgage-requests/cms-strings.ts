/**
 * The mortgage team's CMS copy (docs/mortgage/cms, C1–C6), in English only.
 *
 * Not in messages/: the CMS is English-only permanently (ADR-0007), and a
 * namespace there would make the catalogue tests demand Arabic for screens no
 * one will ever read in Arabic (IMPLEMENTATION.md §1.11). Merged verbatim
 * from the handoff's strings files by a script; the decided deviations are
 * "licence" (D28), neutral pronouns in the invite card (CMS-4) and no
 * time-of-day filter on the slots label (CMS-7). Everything the designs don't
 * cover is listed in PENDING_CMS_COPY.
 *
 * Formatted with next-intl's createTranslator, so ICU plurals and tags work
 * the same as on the website.
 */

import { createTranslator } from "next-intl";

export const CMS_MESSAGES = {
  "activity": {
    "accepted": "{actor} accepted {document}",
    "assigned": {
      "roundRobin": "Round-robin · mortgage team",
      "title": "Assigned to {owner}"
    },
    "atRisk": "Promise at risk",
    "bankPreApproved": {
      "sub": "Letter attached · {fileName}",
      "title": "{bank} pre-approved up to {amount}"
    },
    "booked": {
      "sub": "{format} with {adviser}",
      "title": "{actor} booked {when}"
    },
    "breached": "Promise missed",
    "call": {
      "sub": "{mobile} · {duration}"
    },
    "callLeftMessage": "{actor} called · left a message",
    "callNoAnswer": "{actor} called · no answer",
    "callReached": "{actor} called · reached",
    "claimed": "{owner} claimed this request",
    "consultReceived": {
      "sub": "Mortgage Consultancy · no documents",
      "title": "Request received from the website"
    },
    "downloaded": "{actor} downloaded {document}",
    "edited": "{actor} edited the applicant's details",
    "emailSent": "{actor} sent an email",
    "empty": "Nothing yet.",
    "held": "{actor} marked the consultation held",
    "inviteSent": {
      "sub": "Expires {when}",
      "title": "{actor} sent a pre-approval link"
    },
    "opened": "{actor} opened {document}",
    "packageSent": {
      "sub": "{count} documents · structured summary",
      "title": "Package sent to {banks}"
    },
    "quote": "“{text}”",
    "reassigned": {
      "sub": "by {actor}",
      "title": "Reassigned to {owner}"
    },
    "statusChanged": "Moved to {status}",
    "submitted": {
      "sub": "Confirmation shown · email sent",
      "title": "Submitted from the website"
    },
    "whatsappIn": "<b>{firstName} replied on WhatsApp</b>",
    "whatsappOut": "{actor} sent a WhatsApp"
  },
  "c1": {
    "aria": {
      "next": "Next page",
      "owner": "Owner",
      "prev": "Previous page",
      "search": "Search requests",
      "service": "Service",
      "sort": "Sort order",
      "tabs": "Request status"
    },
    "breached": "{overdue} overdue",
    "breadcrumbs": "Inbox · {open} open · {new} new",
    "claim": "Claim",
    "closedFooter": "Showing {shown} of {total} closed requests",
    "col": {
      "applicant": "Applicant",
      "documents": "Documents",
      "owner": "Owner",
      "promise": "24-hour promise",
      "received": "Received",
      "reference": "Reference",
      "request": "Request",
      "status": "Status"
    },
    "consult": {
      "booked": "{date} · {time}",
      "called": "Called {time}",
      "completed": "Consultation held {date}",
      "emailed": "Emailed {time}",
      "repliedWhatsapp": "Replied on WhatsApp {time}",
      "waiting": "Waiting {duration}",
      "whatsappSent": "WhatsApp sent {time}"
    },
    "docs": {
      "count": "{accepted}/{total}"
    },
    "empty": "No requests here.",
    "emptySearch": "Nothing matches that search.",
    "error": "The requests didn't load. Try again in a moment.",
    "filter": {
      "all": "All"
    },
    "footer": "Showing {shown} of {total} open requests · sorted by promise due",
    "met": "Met",
    "owner": {
      "anyone": "Owner: anyone",
      "me": "Owner: me",
      "person": "Owner: {name}",
      "unassigned": "Owner: unassigned"
    },
    "profile": "{residency} · {employment}",
    "received": {
      "today": "Today {time}"
    },
    "risk": {
      "item": "{name} ({reference}) has {remaining} left",
      "more": "and {count} more",
      "showAll": "Show all",
      "showOnly": "Show only these",
      "title": "{count, plural, one {# pre-approval is inside its last 4 hours.} other {# pre-approvals are inside their last 4 hours.}}"
    },
    "search": {
      "placeholder": "Name, reference or mobile"
    },
    "sort": {
      "promiseDue": "Sort: promise due"
    },
    "tab": {
      "awaiting": "Awaiting applicant",
      "closed": "Closed",
      "contactedBooked": "Contacted & booked",
      "inReview": "In review",
      "new": "New",
      "open": "Open",
      "withBanks": "With banks"
    },
    "tabFooter": "Showing {shown} of {total} requests · sorted by promise due",
    "title": "Mortgage requests"
  },
  "c2": {
    "action": {
      "acceptApplication": "Accept application",
      "requestDocuments": "Request documents"
    },
    "activity": {
      "showLatest": "Show the latest {count}",
      "viewAll": "View all {count}"
    },
    "applicant": {
      "employment": "Employment type",
      "residency": "Residency status",
      "submitted": "Submitted"
    },
    "breadcrumbs": "Inbox › Mortgage requests › {reference}",
    "consent": {
      "given": "Given {givenAt} · {ip} · {browser}, {os}",
      "name": "Share documents with partner banks",
      "pending": "Wording {version} · pending compliance",
      "title": "Consent"
    },
    "docs": {
      "accepted": "{accepted} of {total} accepted",
      "acceptedBy": "Accepted by {name} · {time}",
      "open": "Open",
      "private": "Visible to the mortgage team only. Every open and download is recorded in the activity log.",
      "review": "Review",
      "scanning": "Checking",
      "title": "{employment} document set",
      "uploaded": "Uploaded with the application · {submittedAt}"
    },
    "owner": {
      "reassign": "Reassign",
      "title": "Owner"
    }
  },
  "c6": {
    "action": {
      "book": "Book consultation",
      "sendLink": "Send pre-approval link"
    },
    "applicant": {
      "employment": "Employment",
      "residency": "Residency"
    },
    "book": {
      "adviser": "Adviser",
      "cta": "Book {dateTime}",
      "day": "Day",
      "format": "Format",
      "invite": "Send the invite to {firstName} by email and WhatsApp",
      "needsContact": "Log a contact attempt before booking.",
      "none": "No free slots that day.",
      "office": "Office",
      "passed": "That time has passed. Pick another.",
      "phone": "Phone",
      "taken": "Someone booked that slot a moment ago. Pick another.",
      "time": "Time · {adviserFirstName}'s free slots",
      "title": "Book the consultation",
      "unavailable": "{time}, unavailable",
      "video": "Video"
    },
    "booked": {
      "held": "Mark consultation held",
      "invited": "Invite sent by email",
      "notInvited": "No invite sent",
      "title": "Consultation booked",
      "when": "{when} · {format} with {adviser}"
    },
    "breadcrumbs": "Inbox › Mortgage requests › {reference}",
    "completed": "Completed {when}",
    "docs": {
      "body": "Not required. Consultancy is guidance only, so this request carries personal details and nothing else.",
      "title": "Documents"
    },
    "header": {
      "notContacted": "Received {when} · not contacted yet",
      "received": "Received {when} · first contact {time}"
    },
    "invite": {
      "emailFailed": "The link was made, but the email didn't go. Send a new link to try again.",
      "resend": "Send a new link",
      "sent": "Link sent · expires {when}"
    },
    "log": {
      "call": "Call",
      "label": "Log an attempt",
      "leftMessage": "Left a message",
      "logged": "Logged",
      "noAnswer": "No answer",
      "owner": "Owner · {name}",
      "reached": "Reached",
      "title": "Contact log",
      "whatsapp": "WhatsApp"
    },
    "ready": {
      "body": "Send {firstName} a secure Fast Pre-Approval link. Their details carry over and they'll only see the {employment} document set.",
      "title": "Ready to apply?"
    }
  },
  "card": {
    "activity": "Activity",
    "applicant": "Applicant"
  },
  "claim": {
    "submit": "Claim this request"
  },
  "clock": {
    "breached": "{overdue} overdue",
    "due": "Due {dueAt}",
    "left": "{remaining} left",
    "met": "Met · {elapsed}",
    "paused": "Paused · {remaining} left",
    "stopped": "Stopped"
  },
  "common": {
    "backToFile": "Back to file",
    "call": "Call",
    "cancel": "Cancel",
    "conflict": "Someone else changed this request. Reload to see the latest, then try again.",
    "done": "Done",
    "edit": "Edit",
    "email": "Email",
    "failed": "That didn't go through. Try again in a moment.",
    "notFound": "This request no longer exists.",
    "notOwner": "Only the owner or the Head of mortgages can do this.",
    "notRequired": "Not required",
    "save": "Save",
    "sendBy": "Send by",
    "soonBanks": "Sending to banks comes with the decision screen (a later release).",
    "soonViewer": "Opens with document review (next release).",
    "whatsapp": "WhatsApp"
  },
  "doc": {
    "bankStatements12m": "Last 1 year's bank statements",
    "bankStatements3m": "Last 3 months' bank statements",
    "emiratesId": "Emirates ID",
    "passport": "Passport copy",
    "salaryCertificate": "Salary certificate",
    "tradeLicense": "Business trade licence"
  },
  "docHint": {
    "bankStatements12m": "Several files · PDF · max 40 MB total",
    "bankStatements3m": "Several files · PDF · max 25 MB total",
    "emiratesId": "Front and back · PDF, JPG, PNG · max 10 MB",
    "passport": "Photo page · PDF, JPG, PNG · max 10 MB",
    "salaryCertificate": "Addressed to the bank · PDF · max 10 MB",
    "tradeLicense": "Valid / current · PDF, JPG, PNG · max 10 MB"
  },
  "docState": {
    "accepted": "Accepted",
    "reuploadRequested": "Re-upload requested",
    "toReview": "To review"
  },
  "edit": {
    "employmentLocked": "Employment type decided the document set, so it can't change after submission.",
    "invalid": "Check the highlighted field.",
    "submit": "Save changes",
    "title": "Edit applicant"
  },
  "employment": {
    "businessOwner": "Business Owner",
    "salaried": "Salaried"
  },
  "entry": {
    "calculatorAdvisor": "Mortgage calculator · Talk to advisor",
    "calculatorPreapproval": "Mortgage calculator",
    "consultInvite": "Pre-approval link from a consultation",
    "direct": "Direct",
    "home": "Home page",
    "propertyDetail": "Property page",
    "servicesMenu": "Services menu"
  },
  "field": {
    "dateOfBirth": "Date of birth",
    "dobAge": "{date} · {age}",
    "email": "Email",
    "fullName": "Full name",
    "mobile": "Mobile",
    "startedFrom": "Started from"
  },
  "format": {
    "office": "Office meeting",
    "phone": "Phone call",
    "video": "Video call"
  },
  "ics": {
    "description": "{format} with {adviser}. Your reference is {reference}.",
    "summary": "Mortgage consultation with Bazar"
  },
  "nav": {
    "group": "Inbox",
    "mortgages": "Mortgage requests"
  },
  "notify": {
    "atRisk": "Promise at risk · {reference}",
    "atRiskBody": "{remaining} left · due {dueAt}",
    "breached": "Promise missed · {reference}",
    "breachedBody": "Was due {dueAt}",
    "newRequest": "New {service} request · {reference}"
  },
  "owner": {
    "unassigned": "Unassigned"
  },
  "reassign": {
    "label": "New owner",
    "submit": "Reassign",
    "title": "Reassign"
  },
  "residency": {
    "expat": "UAE Resident / Expat",
    "expatShort": "Expat",
    "uaeNational": "UAE National",
    "withLtv": "{residency} · up to {ltv}% LTV"
  },
  "role": {
    "adviser": "Mortgage adviser",
    "head": "Head of mortgages"
  },
  "service": {
    "consultancy": "Mortgage Consultancy",
    "preApproval": "Fast Pre-Approval"
  },
  "settings": {
    "assignment": {
      "claim": "Nobody until an adviser claims them",
      "round_robin": "The next adviser in turn (round-robin)",
      "title": "New requests go to"
    },
    "breadcrumbs": "Inbox › Mortgage requests › Settings",
    "flag": {
      "off": "Nobody (off)",
      "public": "Everyone (live)",
      "staff": "Signed-in staff only",
      "title": "Who can see the application flow"
    },
    "holidays": {
      "add": "Add holiday",
      "day": "Date",
      "name": "Name",
      "none": "No holidays entered.",
      "remove": "Remove",
      "title": "Public holidays (the promise pauses on these)"
    },
    "hours": {
      "closed": "Closed",
      "title": "Working hours (the 24-hour promise counts these)"
    },
    "link": "Settings",
    "ltv": {
      "expat": "UAE Resident / Expat, up to (%)",
      "national": "UAE National, up to (%)",
      "title": "Loan-to-value shown on the application"
    },
    "save": "Save settings",
    "saved": "Saved.",
    "title": "Mortgage settings"
  },
  "status": {
    "awaitingApplicant": "Awaiting applicant",
    "completed": "Completed",
    "consultationBooked": "Consultation booked",
    "contacted": "Contacted",
    "declined": "Declined",
    "inReview": "In review",
    "new": "New",
    "preApproved": "Pre-approved",
    "withBanks": "With banks"
  },
  "viewer": {
    "breadcrumbs": "Mortgage requests › {reference} · {applicant} › Documents",
    "checks": "Checks",
    "download": "Download",
    "eyebrow": "Reviewing · {index} of {total}",
    "fileAndPage": "File {file} of {files} · page {page} of {total}",
    "fileMeta": "{name} · {pages} · {size}",
    "page": "Page {page} of {total}",
    "pages": "{count, plural, one {# page} other {# pages}}",
    "requestReupload": "Request re-upload",
    "zoom": "{percent}%"
  }
} as const;

/** Keys written here because the designs don't cover them (CMS-2 and friends). */
export const PENDING_CMS_COPY: readonly string[] = [
  "activity.atRisk",
  "activity.booked.sub",
  "activity.booked.title",
  "activity.breached",
  "activity.callLeftMessage",
  "activity.callReached",
  "activity.claimed",
  "activity.downloaded",
  "activity.edited",
  "activity.emailSent",
  "activity.empty",
  "activity.held",
  "activity.inviteSent.sub",
  "activity.inviteSent.title",
  "activity.reassigned.sub",
  "activity.reassigned.title",
  "activity.statusChanged",
  "c1.aria.next",
  "c1.aria.owner",
  "c1.aria.prev",
  "c1.aria.search",
  "c1.aria.service",
  "c1.aria.sort",
  "c1.aria.tabs",
  "c1.breached",
  "c1.claim",
  "c1.closedFooter",
  "c1.consult.called",
  "c1.consult.completed",
  "c1.consult.emailed",
  "c1.consult.whatsappSent",
  "c1.empty",
  "c1.emptySearch",
  "c1.error",
  "c1.met",
  "c1.owner.me",
  "c1.owner.person",
  "c1.owner.unassigned",
  "c1.risk.more",
  "c1.risk.showAll",
  "c1.tabFooter",
  "c2.activity.showLatest",
  "c2.docs.scanning",
  "c6.book.needsContact",
  "c6.book.none",
  "c6.book.passed",
  "c6.book.taken",
  "c6.book.unavailable",
  "c6.booked.held",
  "c6.booked.invited",
  "c6.booked.notInvited",
  "c6.booked.title",
  "c6.booked.when",
  "c6.completed",
  "c6.header.notContacted",
  "c6.invite.emailFailed",
  "c6.invite.resend",
  "c6.invite.sent",
  "c6.log.call",
  "c6.log.logged",
  "c6.log.whatsapp",
  "claim.submit",
  "clock.breached",
  "clock.met",
  "clock.stopped",
  "common.conflict",
  "common.done",
  "common.failed",
  "common.notFound",
  "common.notOwner",
  "common.save",
  "common.soonBanks",
  "common.soonViewer",
  "edit.employmentLocked",
  "edit.invalid",
  "edit.submit",
  "edit.title",
  "entry.consultInvite",
  "entry.direct",
  "entry.home",
  "entry.propertyDetail",
  "entry.servicesMenu",
  "format.office",
  "format.phone",
  "format.video",
  "ics.description",
  "ics.summary",
  "notify.atRisk",
  "notify.atRiskBody",
  "notify.breached",
  "notify.breachedBody",
  "notify.newRequest",
  "reassign.label",
  "reassign.submit",
  "reassign.title",
  "settings.assignment.claim",
  "settings.assignment.round_robin",
  "settings.assignment.title",
  "settings.breadcrumbs",
  "settings.flag.off",
  "settings.flag.public",
  "settings.flag.staff",
  "settings.flag.title",
  "settings.holidays.add",
  "settings.holidays.day",
  "settings.holidays.name",
  "settings.holidays.none",
  "settings.holidays.remove",
  "settings.holidays.title",
  "settings.hours.closed",
  "settings.hours.title",
  "settings.link",
  "settings.ltv.expat",
  "settings.ltv.national",
  "settings.ltv.title",
  "settings.save",
  "settings.saved",
  "settings.title"
];

export const cmsT = createTranslator({ locale: "en", messages: { cms: CMS_MESSAGES }, namespace: "cms" });
