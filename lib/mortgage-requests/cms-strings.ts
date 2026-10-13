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
    "applicationAccepted": {
      "sub": "Ready to share with the partner banks",
      "title": "{actor} accepted the application"
    },
    "assigned": {
      "invite": "Sent the pre-approval link",
      "roundRobin": "Round-robin · mortgage team",
      "title": "Assigned to {owner}"
    },
    "atRisk": "Promise at risk",
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
      "title": "{actor} recorded {firstName}'s withdrawal of consent"
    },
    "consultReceived": {
      "sub": "Mortgage Consultancy · no documents",
      "title": "Request received from the website"
    },
    "declined": "{actor} declined the application",
    "downloaded": "{actor} downloaded {document}",
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
    "preApproved": {
      "title": "{actor} marked it pre-approved"
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
    "reviewStarted": "{actor} started the review from the board",
    "statusChanged": "Moved to {status}",
    "submitted": {
      "sub": "Confirmation shown · email sent",
      "title": "Submitted from the website"
    },
    "whatsappIn": "<b>{firstName} replied on WhatsApp</b>",
    "whatsappOut": "{actor} sent a WhatsApp"
  },
  "board": {
    "closedAll": "All closed",
    "closedMore": "Newest {shown} of {total}",
    "column": "{status}, {count, plural, one {# file} other {# files}}",
    "dialog": {
      "accept": {
        "cta": "Open the file to accept",
        "lede": "Every document must be accepted and consent on file. You accept on the file, beside the documents.",
        "title": "Accept {firstName}'s application"
      },
      "book": {
        "cta": "Open the file to book",
        "lede": "Choose the adviser, the format and the slot on {firstName}'s file. It moves to Consultation booked when you book.",
        "title": "Book {firstName}'s consultation"
      },
      "cancel": {
        "cta": "Cancel the request for {document}",
        "lede": "{firstName}'s file goes back to In review, and its clock runs again, once no re-upload request is left open.",
        "title": "Cancel the re-upload request?"
      },
      "contact": {
        "lede": "Logging the attempt moves {firstName}'s request to Contacted.",
        "title": "How did contacting {firstName} go?"
      },
      "held": {
        "cta": "Mark it held",
        "lede": "{firstName}'s request moves to Completed.",
        "title": "Was the consultation held?"
      },
      "loading": "Reading the file…",
      "preApprove": {
        "cta": "Mark pre-approved",
        "lede": "Record that a partner bank pre-approved {firstName}. This closes the file. Nothing is sent: tell {firstName} yourself.",
        "title": "Mark {firstName} pre-approved?"
      },
      "reupload": {
        "lede": "Choose the document. You write the reason and the message on the next screen, and the file moves to Awaiting applicant when you send it.",
        "requested": "Already requested",
        "title": "Which of {firstName}'s documents needs a re-upload?"
      }
    },
    "done": {
      "startReview": "{reference} is in review."
    },
    "empty": "No files",
    "hint": "Drag a card to another column, or use its Move menu.",
    "illegal": {
      "backwards": "A file can't go back a stage. Its activity shows what happened.",
      "closed": "A closed file stays closed.",
      "needsAccept": "Accept the application first: a pre-approval comes after it is shared with the banks.",
      "needsBooking": "Book the consultation first.",
      "needsContact": "Log a contact first: a request is contacted before it's booked.",
      "needsReview": "Review the documents first: every one must be accepted before the application is.",
      "reuploadOpen": "A re-upload request is still open. Cancel it, or wait for the applicant, first."
    },
    "lane": "{service} · {count, plural, one {# open} other {# open}}",
    "move": "Move",
    "moveTo": "Move {reference} to",
    "refused": {
      "startReview": "Only a new Fast Pre-Approval can start its review."
    }
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
      "accepted": "Accepted",
      "awaiting": "Awaiting applicant",
      "closed": "Closed",
      "contactedBooked": "Contacted & booked",
      "inReview": "In review",
      "new": "New",
      "open": "Open"
    },
    "tabFooter": "Showing {shown} of {total} requests · sorted by promise due",
    "title": "Mortgage requests",
    "view": {
      "board": "Board",
      "label": "View",
      "list": "List"
    },
    "website": {
      "ar": "Arabic",
      "arLabel": "Came from the Arabic website",
      "en": "English",
      "enLabel": "Came from the English website",
      "unknown": "Not recorded"
    }
  },
  "c2": {
    "accept": {
      "consent": "Consent to share with partner banks · {given}",
      "cta": "Accept application",
      "done": "{firstName}'s application is accepted.",
      "lede": "All {count} documents are accepted. Accepting stops the 24-hour clock; you then share the file with the partner banks yourself and record the outcome here.",
      "needsConsent": "Consent isn't on file, so the application can't be accepted.",
      "needsDocuments": "Accept every document first.",
      "title": "Accept {firstName}'s application?"
    },
    "action": {
      "acceptApplication": "Accept application",
      "decline": "Decline",
      "markPreApproved": "Mark pre-approved",
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
        "body": "Use this when {firstName} asks Bazar to stop sharing their documents with partner banks. The file can't be accepted without consent, and the team stops sharing it. This can't be undone.",
        "button": "Record a withdrawal",
        "confirm": "Record withdrawal",
        "done": "{firstName}'s withdrawal is recorded.",
        "none": "There's no consent on file to withdraw.",
        "title": "Record a withdrawal of consent?"
      },
      "withdrawn": "Withdrawn {when}",
      "withdrawnNote": "Don't share this file with the banks."
    },
    "decision": {
      "by": "{name} · {when}",
      "declined": "Declined",
      "message": "Message sent to {firstName}",
      "note": "Note",
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
    "preApproved": {
      "cta": "Mark pre-approved",
      "done": "{firstName} is marked pre-approved.",
      "lede": "Record that a partner bank pre-approved {firstName}. This closes the file. Nothing is sent: tell {firstName} yourself.",
      "noteLabel": "Note for the team (optional)",
      "notePlaceholder": "Which bank, the amount, anything worth keeping",
      "title": "Mark {firstName} pre-approved"
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
      "salaryCertificate": "Required: addressed to the bank · PDF, JPG, PNG · max 10 MB"
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
        "original": "The bank's own statement, not retyped"
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
      "bankStatements12m": "Required: several files · PDF, JPG, PNG · max 40 MB total"
    },
    "send": "Send request to {firstName}",
    "sent": "Request sent to {firstName}.",
    "whatsappPending": "WhatsApp isn't connected yet, so this goes by email."
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
    "noBankOfferTooEarly": "Only an accepted file can be declined for that.",
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
    "bankStatements12m": "Several files · PDF, JPG, PNG · max 40 MB total",
    "bankStatements3m": "Several files · PDF, JPG, PNG · max 25 MB total",
    "emiratesId": "Front and back · PDF, JPG, PNG · max 10 MB",
    "passport": "Photo page · PDF, JPG, PNG · max 10 MB",
    "salaryCertificate": "Addressed to the bank · PDF, JPG, PNG · max 10 MB",
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
    "accepted": "Accepted",
    "awaitingApplicant": "Awaiting applicant",
    "completed": "Completed",
    "consultationBooked": "Consultation booked",
    "contacted": "Contacted",
    "declined": "Declined",
    "inReview": "In review",
    "new": "New",
    "preApproved": "Pre-approved"
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
  "activity.applicationAccepted.sub",
  "activity.applicationAccepted.title",
  "activity.assigned.invite",
  "activity.atRisk",
  "activity.booked.sub",
  "activity.booked.title",
  "activity.breached",
  "activity.callLeftMessage",
  "activity.callReached",
  "activity.claimed",
  "activity.consentWithdrawn.title",
  "activity.declined",
  "activity.downloaded",
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
  "activity.preApproved.title",
  "activity.reassigned.sub",
  "activity.reassigned.title",
  "activity.reuploadCancelled",
  "activity.reuploadFiles",
  "activity.reuploadReceived",
  "activity.reuploadRequested",
  "activity.reviewStarted",
  "activity.statusChanged",
  "board.closedAll",
  "board.closedMore",
  "board.column",
  "board.dialog.accept.cta",
  "board.dialog.accept.lede",
  "board.dialog.accept.title",
  "board.dialog.book.cta",
  "board.dialog.book.lede",
  "board.dialog.book.title",
  "board.dialog.cancel.cta",
  "board.dialog.cancel.lede",
  "board.dialog.cancel.title",
  "board.dialog.contact.lede",
  "board.dialog.contact.title",
  "board.dialog.held.cta",
  "board.dialog.held.lede",
  "board.dialog.held.title",
  "board.dialog.loading",
  "board.dialog.preApprove.cta",
  "board.dialog.preApprove.lede",
  "board.dialog.preApprove.title",
  "board.dialog.reupload.lede",
  "board.dialog.reupload.requested",
  "board.dialog.reupload.title",
  "board.done.startReview",
  "board.empty",
  "board.hint",
  "board.illegal.backwards",
  "board.illegal.closed",
  "board.illegal.needsAccept",
  "board.illegal.needsBooking",
  "board.illegal.needsContact",
  "board.illegal.needsReview",
  "board.illegal.reuploadOpen",
  "board.lane",
  "board.move",
  "board.moveTo",
  "board.refused.startReview",
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
  "c1.tab.accepted",
  "c1.tabFooter",
  "c1.view.board",
  "c1.view.label",
  "c1.view.list",
  "c1.website.ar",
  "c1.website.arLabel",
  "c1.website.en",
  "c1.website.enLabel",
  "c1.website.unknown",
  "c2.accept.consent",
  "c2.accept.cta",
  "c2.accept.done",
  "c2.accept.lede",
  "c2.accept.needsConsent",
  "c2.accept.needsDocuments",
  "c2.accept.title",
  "c2.action.decline",
  "c2.action.markPreApproved",
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
  "c2.decision.note",
  "c2.decision.title",
  "c2.preApproved.cta",
  "c2.preApproved.done",
  "c2.preApproved.lede",
  "c2.preApproved.noteLabel",
  "c2.preApproved.notePlaceholder",
  "c2.preApproved.title",
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
  "status.accepted",
  "viewer.loadFailed",
  "viewer.noFiles",
  "viewer.required",
  "viewer.rotate",
  "viewer.stage",
  "viewer.tabs",
  "viewer.zoomIn",
  "viewer.zoomOut",
];

export const cmsT = createTranslator({ locale: "en", messages: { cms: CMS_MESSAGES }, namespace: "cms" });
