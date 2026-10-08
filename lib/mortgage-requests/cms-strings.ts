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
      "invite": "Sent the pre-approval link",
      "roundRobin": "Round-robin · mortgage team",
      "title": "Assigned to {owner}"
    },
    "atRisk": "Promise at risk",
    "bankDeclined": "{bank} declined",
    "bankDownloaded": "{bank} downloaded {document}",
    "bankPreApproved": {
      "sub": "Letter attached · {fileName}",
      "title": "{bank} pre-approved up to {amount}"
    },
    "bankReminder": "Reminder sent to {bank}",
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
    "consentWithdrawn": {
      "sub": "{count, plural, one {# bank link stopped} other {# bank links stopped}}",
      "title": "{actor} recorded {firstName}'s withdrawal of consent"
    },
    "consultReceived": {
      "sub": "Mortgage Consultancy · no documents",
      "title": "Request received from the website"
    },
    "declined": "{actor} declined the application",
    "downloaded": "{actor} downloaded {document}",
    "downloadedLetter": "{actor} downloaded a bank's letter",
    "dsrExported": "The applicant's data was exported at their request",
    "edited": "{actor} edited the applicant's details",
    "emailSent": "{actor} sent an email",
    "empty": "Nothing yet.",
    "filesPurged": "{count, plural, one {# file deleted: the retention period ended} other {# files deleted: the retention period ended}}",
    "held": "{actor} marked the consultation held",
    "inviteSent": {
      "sub": "Expires {when}",
      "title": "{actor} sent a pre-approval link"
    },
    "inviteUsed": "{firstName} applied for Fast Pre-Approval",
    "linkLocked": "The secure link locked after five wrong codes",
    "opened": "{actor} opened {document}",
    "openedLetter": "{actor} opened a bank's letter",
    "packageOpened": "{bank} opened the package",
    "packageSent": {
      "sub": "{count} documents · structured summary",
      "title": "Package sent to {banks}"
    },
    "preApproved": {
      "sub": "{bank} · up to {amount}",
      "title": "{actor} sent the pre-approval"
    },
    "quote": "“{text}”",
    "reassigned": {
      "sub": "by {actor}",
      "title": "Reassigned to {owner}"
    },
    "reuploadCancelled": "{actor} cancelled the request for {document}",
    "reuploadFiles": "{count, plural, one {# file} other {# files}}",
    "reuploadReceived": "{firstName} sent {document}",
    "reuploadRequested": "{actor} asked for {document} again",
    "statusChanged": "Moved to {status}",
    "submitted": {
      "sub": "Confirmation shown · email sent",
      "title": "Submitted from the website"
    },
    "whatsappIn": "<b>{firstName} replied on WhatsApp</b>",
    "whatsappOut": "{actor} sent a WhatsApp"
  },
  "banks": {
    "active": "Active",
    "add": "Add bank",
    "col": {
      "bank": "Bank",
      "inboxes": "Package inboxes",
      "status": "Status"
    },
    "dialog": {
      "add": "Add a partner bank",
      "edit": "Edit {name}"
    },
    "edit": "Edit",
    "empty": "No partner banks yet. Add the banks Bazar sends files to.",
    "error": {
      "codeTaken": "Another bank already uses that code.",
      "invalid": "Check the code, the name and the addresses.",
      "needsInbox": "An active bank needs a package inbox."
    },
    "field": {
      "active": "Offer this bank when sending a file",
      "code": "Code",
      "codeHint": "2–12 capital letters or digits, as the team calls the bank: FAB, ADCB.",
      "colour": "Colour",
      "inboxes": "Package inboxes",
      "inboxesHint": "One address per line, up to five. Each gets the package.",
      "name": "Name",
      "order": "Order"
    },
    "inactive": "Switched off",
    "lede": "The banks a file can be sent to. Each gets its packages at its package inboxes, as a secure link.",
    "link": "Partner banks",
    "readOnly": "Only the Head of mortgages or an admin can change the partner banks.",
    "save": "Save bank",
    "saved": "Saved.",
    "settingsNote": "The mortgage team's Head keeps the same list in the Mortgage requests section.",
    "title": "Partner banks"
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
      "status": "Status",
      "website": "Website"
    },
    "website": {
      "ar": "Arabic",
      "arLabel": "Came from the Arabic website",
      "en": "English",
      "enLabel": "Came from the English website",
      "unknown": "Not recorded"
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
      "decision": "Open decision",
      "decline": "Decline",
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
      "title": "Consent",
      "withdraw": {
        "body": "Use this when {firstName} asks Bazar to stop sharing their documents with partner banks. Banks still deciding are withdrawn, every package link on this file stops working now, and nothing more can be sent to a bank. This can't be undone.",
        "button": "Record a withdrawal",
        "confirm": "Record withdrawal",
        "done": "{firstName}'s withdrawal is recorded. The banks' links have stopped.",
        "none": "There's no consent on file to withdraw.",
        "title": "Record a withdrawal of consent?"
      },
      "withdrawn": "Withdrawn {when}",
      "withdrawnNote": "Nothing more can be shared with the banks."
    },
    "decision": {
      "by": "{name} · {when}",
      "declined": "Declined",
      "message": "Message sent to {firstName}",
      "title": "Decision"
    },
    "docs": {
      "accepted": "{accepted} of {total} accepted",
      "acceptedBy": "Accepted by {name} · {time}",
      "open": "Open",
      "private": "Visible to the mortgage team only. Every open and download is recorded in the activity log.",
      "review": "Review",
      "title": "{employment} document set",
      "uploaded": "Uploaded with the application · {submittedAt}"
    },
    "owner": {
      "reassign": "Reassign",
      "title": "Owner"
    },
    "request": {
      "continue": "Continue",
      "label": "Which document?",
      "none": "Every document is accepted or already requested.",
      "title": "Request documents"
    },
    "reupload": {
      "cancel": "Cancel request",
      "cancelled": "Request cancelled.",
      "confirm": {
        "body": "The link we sent {firstName} for their {document} will stop working, and the 24-hour clock starts again.",
        "keep": "Keep request",
        "title": "Cancel this request?"
      },
      "sent": "Requested {when} · {reason}"
    },
    "send": {
      "addBanks": "Add partner banks",
      "banks": "Partner banks",
      "consent": "Consent on file · {given}",
      "cta": "{count, plural, =0 {Choose a bank} one {Send to # bank} other {Send to # banks}}",
      "done": "Sent to {banks}.",
      "emailFailed": "The file is with the banks, but the email to {bank} didn't go. Send a reminder from the decision page.",
      "emailPartial": "The file is with the banks, but the email to {bank} didn't reach every inbox. Send a reminder from the decision page.",
      "emailSkipped": "The file is with the banks, but this site isn't sending email, so nothing went to {bank}.",
      "lede": "Each bank gets a structured summary and the {count} accepted documents through a secure link of its own, working until {expires}. Every open and download is recorded.",
      "noInbox": "No package inbox",
      "none": "No partner banks are set up yet.",
      "title": "Send {firstName}'s file to partner banks"
    }
  },
  "c3": {
    "accepted": "Document accepted.",
    "acceptedBy": "Accepted by {name} · {time}",
    "action": {
      "accept": "Accept document"
    },
    "allAccepted": "Back to file →",
    "awaiting": "Waiting for {firstName} · requested {when}",
    "check": {
      "salary": {
        "addressed": "Addressed to a bank",
        "name": "Name matches the application",
        "recent": "Issued within the last 30 days",
        "signed": "Signed and stamped by the employer",
        "stated": "Monthly salary stated"
      },
      "value": {
        "issued": "{date} · {days} days ago",
        "salary": "AED {amount} gross",
        "signed": "HR signature and company stamp"
      }
    },
    "fieldsNeeded": "Record the three figures to accept.",
    "invalidAed": "A whole amount in AED.",
    "next": "Next: {document} →",
    "opened": "Opened by {name} · {time} · logged",
    "openedPending": "Opening…",
    "period": {
      "from": "From",
      "hint": "Set the months each file covers; coverage follows.",
      "pick": "Month",
      "title": "Statement periods",
      "to": "To"
    },
    "readOnlyAccepted": "Accepted documents can't be changed.",
    "record": {
      "employedSince": "Employed since",
      "employer": "Employer",
      "salary": "Monthly gross salary",
      "title": "Record for pricing"
    },
    "required": {
      "salaryCertificate": "Required: addressed to the bank · PDF · max 10 MB"
    },
    "saved": "Saved"
  },
  "c4": {
    "channelRequired": "Choose at least one way to send it.",
    "check": {
      "covers": "Covers the last 12 months",
      "holder": "Account holder matches the trade licence",
      "issued": "Issued by the bank",
      "value": {
        "missing": "{months} missing",
        "original": "Original PDFs, not scans"
      }
    },
    "coverage": {
      "count": "{have} of {total}",
      "title": "Coverage · last 12 months",
      "titleN": "Coverage · last {count} months"
    },
    "emailSkipped": "The request is recorded, but this site isn't sending email, so the link didn't reach {firstName}.",
    "message": {
      "example": "Your statements cover September 2025 to May 2026. For a full year, please add June, July and August 2026.",
      "label": "Message to {firstName}"
    },
    "messageRequired": "Write a message.",
    "pause": "The 24-hour clock pauses until {firstName} uploads. {count, plural, =0 {No other document is accepted yet.} one {Their accepted document stays accepted.} other {Their # accepted documents stay accepted.}}",
    "prefill": {
      "months": "Your statements cover {received}. Please add {missing}.",
      "none": "Please add statements for {missing}.",
      "year": "Your statements cover {received}. For a full year, please add {missing}."
    },
    "reason": {
      "expired": "Expired",
      "other": "Other",
      "pagesMissing": "Pages missing",
      "periodIncomplete": "Period incomplete",
      "unreadable": "Unreadable",
      "wrongDocument": "Wrong document"
    },
    "reasonRequired": "Choose a reason.",
    "required": {
      "bankStatements12m": "Required: several files · PDF · max 40 MB total"
    },
    "send": "Send request to {firstName}",
    "sent": "Request sent to {firstName}.",
    "whatsappPending": "WhatsApp isn't connected yet, so this goes by email."
  },
  "c5": {
    "bank": {
      "awaiting": "Awaiting reply · sent {time}",
      "declined": "Declined · {time}",
      "editResponse": "Edit",
      "monthly": "25 yrs · monthly",
      "preApproved": "Pre-approved · {time}",
      "rate": "Rate",
      "rateValue": "{rate}% fixed · {years} yrs",
      "rateVariable": "{rate}% variable",
      "record": "Record response",
      "reminder": "Send a reminder",
      "reminderSent": "Reminder sent {time}",
      "upTo": "Up to",
      "withdrawn": "Withdrawn"
    },
    "banks": {
      "basis": "Priced on a monthly gross salary of {salary} (salary certificate) and a maximum LTV of {ltv}% ({residency}).",
      "basisBusiness": "Priced on 12 months of business bank statements and a maximum LTV of {ltv}% ({residency}).",
      "basisNoSalary": "Priced on a maximum LTV of {ltv}% ({residency}); the salary isn't recorded yet.",
      "hint": "Choose the offer to lead with",
      "none": "No bank has answered yet.",
      "title": "Partner bank responses"
    },
    "breadcrumbs": "Inbox › Mortgage requests › {reference} › Decision",
    "channel": {
      "emailLetter": "Email + letter"
    },
    "cta": {
      "needsConsent": "Consent isn't on file.",
      "needsLead": "Choose the offer to lead with first.",
      "note": "Moves the file to Pre-approved and stops the clock at {elapsed}.",
      "noteNoClock": "Moves the file to Pre-approved.",
      "title": "Confirm pre-approval & notify {firstName}",
      "withdraws": "{count, plural, one {The bank still deciding is withdrawn, and its link stops working.} other {The # banks still deciding are withdrawn, and their links stop working.}}"
    },
    "decided": "Decided {when}.",
    "decision": {
      "decline": "Decline",
      "preApprove": "Pre-approve",
      "title": "Decision"
    },
    "done": "Pre-approved. {firstName} has been emailed, with the letter.",
    "lead": {
      "expired": "{bank}'s offer expired on {date}. Record a new one or choose another.",
      "letterMissing": "{bank}'s letter is still being checked.",
      "none": "Choose a pre-approved offer to lead with.",
      "offer": "Lead offer",
      "offerValue": "{bank} · up to {amount}",
      "rate": "Rate",
      "rateValue": "{rate}% fixed for {years} years",
      "rateVariableValue": "{rate}% variable",
      "validUntil": "Valid until",
      "validValue": "{date} · {days, plural, =0 {last day} one {# day} other {# days}}"
    },
    "message": {
      "example": "Good news, Priya: you're pre-approved. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3.99% fixed for 3 years, valid until 21 November 2026. ADCB has also pre-approved you for up to AED 2,000,000.\n\nI'll call you tomorrow morning to talk through both. Yasmin",
      "label": "Message to {firstName}"
    },
    "record": {
      "amount": "Up to (AED)",
      "declined": "Declined",
      "edit": "Edit {bank}'s response",
      "fixed": "Fixed",
      "invalid": "Check the amount, the rate, the term and the date.",
      "letter": "Pre-approval letter",
      "letterBusy": "Checking the letter…",
      "letterFailed": "That file can't be used. Upload the bank's letter as a PDF of up to 10 MB, without a password.",
      "letterOpen": "Open",
      "letterReplace": "Replace",
      "letterUpload": "Upload the letter (PDF)",
      "needsLetter": "Upload the bank's letter first.",
      "notes": "Notes for the team",
      "outcome": "Response",
      "preApproved": "Pre-approved",
      "rate": "Rate (%)",
      "save": "Save response",
      "saved": "{bank}'s response is recorded.",
      "title": "Record {bank}'s response",
      "type": "Rate",
      "validUntil": "Valid until",
      "variable": "Variable",
      "years": "Fixed for (years)"
    },
    "reminder": {
      "emailFailed": "The reminder to {bank} didn't go, and its earlier link has stopped. Send another in 10 minutes.",
      "emailSkipped": "This site isn't sending email, so no reminder went to {bank}, and its earlier link has stopped.",
      "noConsent": "The applicant withdrew their consent, so no new link can go to {bank}.",
      "partial": "The reminder reached only some of {bank}'s inboxes. Its earlier link has stopped; send another in 10 minutes.",
      "recent": "A reminder went to {bank} a few minutes ago.",
      "sent": "Reminder sent to {bank}."
    },
    "template": {
      "also": "{bank} has also pre-approved you for up to {amount}.",
      "close": "{count, plural, one {I'll call you tomorrow morning to talk it through.} =2 {I'll call you tomorrow morning to talk through both.} other {I'll call you tomorrow morning to talk through them all.}}",
      "leadFixed": "{bank} has pre-approved you for up to {amount} at {rate}% fixed for {years} years, valid until {validUntil}.",
      "leadVariable": "{bank} has pre-approved you for up to {amount} at {rate}% variable, valid until {validUntil}.",
      "opening": "Good news, {firstName}: you're pre-approved."
    },
    "tile": {
      "consent": {
        "sub": "Partner-bank sharing · {givenAt}",
        "title": "Consent on file"
      },
      "consentMissing": {
        "sub": "Nothing more can be shared with the banks.",
        "title": "Consent isn't on file"
      },
      "docs": {
        "sub": "Last one accepted by {name} at {time}",
        "title": "{accepted} of {total} documents accepted"
      },
      "sent": {
        "sub": "Package shared at {time}",
        "title": "Sent to {count, plural, one {# partner bank} other {# partner banks}}"
      }
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
      "emailSkipped": "The link was made, but this site isn't sending email, so it didn't reach {firstName}.",
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
    "whatsapp": "WhatsApp"
  },
  "decline": {
    "cta": "Decline & notify {firstName}",
    "done": "Declined. {firstName} has been emailed.",
    "lede": "Choose a reason, then check the message. It goes to {firstName} by email, and a decision can't be undone.",
    "messageLabel": "Message to {firstName}",
    "messageRequired": "Write the message {firstName} will read.",
    "noBankOfferTooEarly": "Only a file that went to the banks can be declined for that.",
    "note": "Moves the file to Declined and stops the clock at {elapsed}.",
    "noteAwaiting": "The open re-upload request is cancelled, and its link stops working.",
    "noteNoClock": "Moves the file to Declined.",
    "otherHint": "Say why in your own words before sending.",
    "reason": {
      "ageAtTermEnd": "Age at the end of the term",
      "creditReport": "Credit report (AECB)",
      "debtBurden": "Monthly debts too high (DBR)",
      "documentsIncomplete": "Documents incomplete",
      "employmentHistory": "Too short in the job or business",
      "incomeBelowMinimum": "Income below the banks' minimum",
      "noBankOffer": "No bank made an offer",
      "other": "Other"
    },
    "reasonLabel": "Reason",
    "reasonRequired": "Choose a reason.",
    "template": {
      "closing": "If you'd like to talk it through, just reply to this email.",
      "next": {
        "ageAtTermEnd": "A larger down payment or a joint application can change that, and we're happy to talk through the options.",
        "creditReport": "You can ask AECB for a copy of your report to see what it shows. Once it has improved, we'd be glad to look at your application again.",
        "debtBurden": "Paying down or closing a loan or credit card can bring you back within it, and we can then look at your application again.",
        "documentsIncomplete": "If you'd like to try again, reply to this email and we'll help you get everything together.",
        "employmentHistory": "Once you have, we'd be glad to pick your application up again.",
        "incomeBelowMinimum": "If your income changes, or you'd like to apply together with a spouse or family member, we'd be glad to look at it again.",
        "noBankOffer": "Banks change their criteria from time to time, and we're happy to talk through what might help."
      },
      "opening": "{firstName}, thank you for applying for Fast Pre-Approval with Bazar. I've been through your application carefully, and I'm sorry to say we're not able to secure a pre-approval for you at the moment.",
      "why": {
        "ageAtTermEnd": "Banks need a mortgage to be fully repaid by a set age, which leaves too short a term for the amount you'd need to borrow.",
        "creditReport": "The banks look at each applicant's report from the Al Etihad Credit Bureau (AECB), and yours doesn't currently meet their requirements.",
        "debtBurden": "UAE Central Bank rules cap your total monthly repayments, including the new mortgage, at half of your monthly income. With your current loan and card repayments, a mortgage would take you over that limit.",
        "documentsIncomplete": "We haven't been able to complete the documents your application needs, so we can't take it to the banks.",
        "employmentHistory": "The banks ask for a minimum time with your current employer, or a minimum trading history for a business, and you haven't reached it yet.",
        "incomeBelowMinimum": "Our partner banks each set a minimum monthly income for a mortgage, and yours is currently below it.",
        "noBankOffer": "We shared your application with our partner banks, and none of them is able to offer you a pre-approval at the moment."
      }
    },
    "title": "Decline {firstName}'s application"
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
  "docShort": {
    "bankStatements12m": "bank statements",
    "bankStatements3m": "bank statements",
    "emiratesId": "Emirates ID",
    "passport": "passport copy",
    "salaryCertificate": "salary certificate",
    "tradeLicense": "trade licence"
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
    "newRequest": "New {service} request · {reference}",
    "reupload": "Re-upload received · {reference}",
    "reuploadBody": "{document} · back in review"
  },
  "owner": {
    "unassigned": "Unassigned"
  },
  "pkg": {
    "contact": "Questions? Reply to the email this link came in, or call Bazar's mortgage team on +971 2 632 2223.",
    "documents": "Documents",
    "download": "Download",
    "eyebrow": "{reference} · Fast Pre-Approval",
    "field": {
      "employedSince": "Employed since",
      "employer": "Employer",
      "ltv": "Maximum LTV",
      "salary": "Monthly gross salary"
    },
    "fileMeta": "{name} · {meta}",
    "lede": "{adviser} from Bazar's mortgage team shared this application with {bank} on {sentAt}. The link works until {expires}, and every open and download is recorded.",
    "state": {
      "expired": {
        "body": "Ask Bazar's mortgage team for a fresh link: reply to the email it came in.",
        "title": "This package link has expired"
      },
      "unavailable": {
        "body": "It may have been withdrawn, or the link is incomplete. Call Bazar's mortgage team on +971 2 632 2223.",
        "title": "This package isn't available"
      }
    },
    "summary": "Summary",
    "title": "A Fast Pre-Approval package from Bazar"
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
    "promise": {
      "median": "Median {duration} of working time from submission to decision",
      "met": "{met} of {decided} Fast Pre-Approvals decided within 24 working hours ({pct}%)",
      "missed": "{count, plural, one {# missed the promise} other {# missed the promise}}",
      "none": "No Fast Pre-Approval was decided in the last {days} days.",
      "title": "The 24-hour promise · last {days} days"
    },
    "retention": {
      "how": "The period is set by an engineer once compliance decides; see the runbook.",
      "set": "{months, plural, one {Deleted # month after the request closes, by a daily job.} other {Deleted # months after the request closes, by a daily job.}}",
      "title": "Documents after a request closes",
      "unset": "Kept until compliance sets how long (decision D7). Nothing is deleted."
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
    "loadFailed": "The file didn't open. Reload to try again.",
    "noFiles": "No files yet.",
    "page": "Page {page} of {total}",
    "pages": "{count, plural, one {# page} other {# pages}}",
    "requestReupload": "Request re-upload",
    "required": "Required: {hint}",
    "rotate": "Rotate",
    "stage": "{document}, page {page} of {total}",
    "tabs": "Documents",
    "zoom": "{percent}%",
    "zoomIn": "Zoom in",
    "zoomOut": "Zoom out"
  }
} as const;

/** Keys written here because the designs don't cover them (CMS-2 and friends). */
export const PENDING_CMS_COPY: readonly string[] = [
  "activity.assigned.invite",
  "activity.atRisk",
  "activity.bankDeclined",
  "activity.bankDownloaded",
  "activity.bankReminder",
  "activity.booked.sub",
  "activity.booked.title",
  "activity.breached",
  "activity.callLeftMessage",
  "activity.callReached",
  "activity.claimed",
  "activity.consentWithdrawn.sub",
  "activity.consentWithdrawn.title",
  "activity.declined",
  "activity.downloaded",
  "activity.downloadedLetter",
  "activity.dsrExported",
  "activity.edited",
  "activity.emailSent",
  "activity.empty",
  "activity.filesPurged",
  "activity.held",
  "activity.inviteSent.sub",
  "activity.inviteSent.title",
  "activity.inviteUsed",
  "activity.linkLocked",
  "activity.openedLetter",
  "activity.packageOpened",
  "activity.preApproved.sub",
  "activity.preApproved.title",
  "activity.reassigned.sub",
  "activity.reassigned.title",
  "activity.reuploadCancelled",
  "activity.reuploadFiles",
  "activity.reuploadReceived",
  "activity.reuploadRequested",
  "activity.statusChanged",
  "banks.active",
  "banks.add",
  "banks.col.bank",
  "banks.col.inboxes",
  "banks.col.status",
  "banks.dialog.add",
  "banks.dialog.edit",
  "banks.edit",
  "banks.empty",
  "banks.error.codeTaken",
  "banks.error.invalid",
  "banks.error.needsInbox",
  "banks.field.active",
  "banks.field.code",
  "banks.field.codeHint",
  "banks.field.colour",
  "banks.field.inboxes",
  "banks.field.inboxesHint",
  "banks.field.name",
  "banks.field.order",
  "banks.inactive",
  "banks.lede",
  "banks.link",
  "banks.readOnly",
  "banks.save",
  "banks.saved",
  "banks.settingsNote",
  "banks.title",
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
  "c1.col.website",
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
  "c1.website.ar",
  "c1.website.arLabel",
  "c1.website.en",
  "c1.website.enLabel",
  "c1.website.unknown",
  "c2.action.decision",
  "c2.action.decline",
  "c2.activity.showLatest",
  "c2.consent.withdraw.body",
  "c2.consent.withdraw.button",
  "c2.consent.withdraw.confirm",
  "c2.consent.withdraw.done",
  "c2.consent.withdraw.none",
  "c2.consent.withdraw.title",
  "c2.consent.withdrawn",
  "c2.consent.withdrawnNote",
  "c2.decision.by",
  "c2.decision.declined",
  "c2.decision.message",
  "c2.decision.title",
  "c2.request.continue",
  "c2.request.label",
  "c2.request.none",
  "c2.request.title",
  "c2.reupload.cancel",
  "c2.reupload.cancelled",
  "c2.reupload.confirm.body",
  "c2.reupload.confirm.keep",
  "c2.reupload.confirm.title",
  "c2.reupload.sent",
  "c2.send.addBanks",
  "c2.send.banks",
  "c2.send.consent",
  "c2.send.cta",
  "c2.send.done",
  "c2.send.emailFailed",
  "c2.send.emailPartial",
  "c2.send.emailSkipped",
  "c2.send.lede",
  "c2.send.noInbox",
  "c2.send.none",
  "c2.send.title",
  "c3.accepted",
  "c3.acceptedBy",
  "c3.allAccepted",
  "c3.awaiting",
  "c3.fieldsNeeded",
  "c3.invalidAed",
  "c3.openedPending",
  "c3.period.from",
  "c3.period.hint",
  "c3.period.pick",
  "c3.period.title",
  "c3.period.to",
  "c3.readOnlyAccepted",
  "c3.saved",
  "c4.channelRequired",
  "c4.coverage.titleN",
  "c4.emailSkipped",
  "c4.messageRequired",
  "c4.prefill.months",
  "c4.prefill.none",
  "c4.prefill.year",
  "c4.reasonRequired",
  "c4.sent",
  "c4.whatsappPending",
  "c5.bank.declined",
  "c5.bank.editResponse",
  "c5.bank.rateVariable",
  "c5.bank.record",
  "c5.bank.reminderSent",
  "c5.bank.withdrawn",
  "c5.banks.basisBusiness",
  "c5.banks.basisNoSalary",
  "c5.banks.none",
  "c5.cta.needsConsent",
  "c5.cta.needsLead",
  "c5.cta.noteNoClock",
  "c5.cta.withdraws",
  "c5.decided",
  "c5.done",
  "c5.lead.expired",
  "c5.lead.letterMissing",
  "c5.lead.none",
  "c5.lead.rateVariableValue",
  "c5.record.amount",
  "c5.record.declined",
  "c5.record.edit",
  "c5.record.fixed",
  "c5.record.invalid",
  "c5.record.letter",
  "c5.record.letterBusy",
  "c5.record.letterFailed",
  "c5.record.letterOpen",
  "c5.record.letterReplace",
  "c5.record.letterUpload",
  "c5.record.needsLetter",
  "c5.record.notes",
  "c5.record.outcome",
  "c5.record.preApproved",
  "c5.record.rate",
  "c5.record.save",
  "c5.record.saved",
  "c5.record.title",
  "c5.record.type",
  "c5.record.validUntil",
  "c5.record.variable",
  "c5.record.years",
  "c5.reminder.emailFailed",
  "c5.reminder.emailSkipped",
  "c5.reminder.noConsent",
  "c5.reminder.partial",
  "c5.reminder.recent",
  "c5.reminder.sent",
  "c5.template.also",
  "c5.template.close",
  "c5.template.leadFixed",
  "c5.template.leadVariable",
  "c5.template.opening",
  "c5.tile.consentMissing.sub",
  "c5.tile.consentMissing.title",
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
  "c6.invite.emailSkipped",
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
  "decline.cta",
  "decline.done",
  "decline.lede",
  "decline.messageLabel",
  "decline.messageRequired",
  "decline.noBankOfferTooEarly",
  "decline.note",
  "decline.noteAwaiting",
  "decline.noteNoClock",
  "decline.otherHint",
  "decline.reason.ageAtTermEnd",
  "decline.reason.creditReport",
  "decline.reason.debtBurden",
  "decline.reason.documentsIncomplete",
  "decline.reason.employmentHistory",
  "decline.reason.incomeBelowMinimum",
  "decline.reason.noBankOffer",
  "decline.reason.other",
  "decline.reasonLabel",
  "decline.reasonRequired",
  "decline.template.closing",
  "decline.template.next.ageAtTermEnd",
  "decline.template.next.creditReport",
  "decline.template.next.debtBurden",
  "decline.template.next.documentsIncomplete",
  "decline.template.next.employmentHistory",
  "decline.template.next.incomeBelowMinimum",
  "decline.template.next.noBankOffer",
  "decline.template.opening",
  "decline.template.why.ageAtTermEnd",
  "decline.template.why.creditReport",
  "decline.template.why.debtBurden",
  "decline.template.why.documentsIncomplete",
  "decline.template.why.employmentHistory",
  "decline.template.why.incomeBelowMinimum",
  "decline.template.why.noBankOffer",
  "decline.title",
  "docShort.bankStatements12m",
  "docShort.bankStatements3m",
  "docShort.emiratesId",
  "docShort.passport",
  "docShort.salaryCertificate",
  "docShort.tradeLicense",
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
  "notify.reupload",
  "notify.reuploadBody",
  "pkg.contact",
  "pkg.documents",
  "pkg.download",
  "pkg.eyebrow",
  "pkg.field.employedSince",
  "pkg.field.employer",
  "pkg.field.ltv",
  "pkg.field.salary",
  "pkg.fileMeta",
  "pkg.lede",
  "pkg.state.expired.body",
  "pkg.state.expired.title",
  "pkg.state.unavailable.body",
  "pkg.state.unavailable.title",
  "pkg.summary",
  "pkg.title",
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
  "settings.promise.median",
  "settings.promise.met",
  "settings.promise.missed",
  "settings.promise.none",
  "settings.promise.title",
  "settings.retention.how",
  "settings.retention.set",
  "settings.retention.title",
  "settings.retention.unset",
  "settings.save",
  "settings.saved",
  "settings.title",
  "viewer.loadFailed",
  "viewer.noFiles",
  "viewer.required",
  "viewer.rotate",
  "viewer.stage",
  "viewer.tabs",
  "viewer.zoomIn",
  "viewer.zoomOut"
];

export const cmsT = createTranslator({ locale: "en", messages: { cms: CMS_MESSAGES }, namespace: "cms" });
