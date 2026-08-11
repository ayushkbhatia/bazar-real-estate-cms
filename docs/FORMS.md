# Forms Manager

Every lead-capture form on bazar.ae, editable at `/admin/forms`: whether it
shows, what it asks, in what order, what its button says, what the visitor
reads afterwards, and everything it has collected.

## Why it exists

Twenty forms were spread across the codebase with their field lists, labels,
buttons and confirmations written in JSX. Changing "Submit" to "Request a
callback" was a deploy, adding "Which floor do you live on?" was a schema
conversation, and there was no single place to see what any of them had
actually collected — the leads landed in Enquiries, but the *questions* lived
nowhere.

## The split with Pages & blocks

A page owns the words **around** a form — the heading, the blurb, the
photograph beside it. The Forms Manager owns the form: its fields, its button,
its confirmation.

The line is drawn in the registry:

- `headingSource` names the master-page section that owns the surrounding copy.
  The manager links to it rather than offering a second field.
- `copyFromPage: true` means even the button and confirmation live in Pages &
  blocks. Three of the service forms had them there before this existed, and a
  second writable copy of one string is a bug waiting to happen — so the
  manager shows them read-only and links out.

## How resolution works

Same contract as `lib/master-pages`:

```
registry defaults  (lib/forms/registry.ts)   ← what exists
        ↓ merged at read time
stored rows        (forms + form_fields)     ← what an editor changed
        ↓
ResolvedForm                                 ← what renders
```

- **No stored rows** ⇒ the registry's fields, verbatim. A form nobody has
  opened renders exactly as it always has.
- **Stored rows exist** ⇒ storage wins entirely. A registry field the editor
  deleted stays deleted; a field they invented is kept; the order is theirs.
- **A `locked` field is re-attached either way** — a newsletter with no email
  box is not a smaller newsletter, it is a broken one. The editor is refused
  rather than silently corrected.
- **Any failure** — missing table, unapplied migration, no env, dead database —
  falls back to the registry. The failure mode is "the CMS edits don't apply
  yet", never "the form is gone".

That is also why migration `0094_forms_manager.sql` seeds nothing: applying it
is a no-op for the public site until someone opens the manager.

## Where a submission goes

`submitForm` (`app/(public)/_actions/forms.ts`) re-resolves the form
server-side — the browser's copy of the field list is never trusted — validates
against the same schema the browser used, then hands off to whichever action
already owned that lead type:

| handler | goes to |
|---|---|
| `enquiry` | `createEnquiry` → `enquiries` (routing, trigger, Resend auto-reply) |
| `service_lead` | `submitServiceLead` → `enquiries` with community routing |
| `newsletter` | `subscribeToNewsletter` → double opt-in |
| `list_property`, `valuation` | bespoke components; they call their own actions |

Every path also calls `captureFormSubmission`, which writes the
`form_submissions` row **and** emails whoever is on that form's notification
list (Settings tab). One function for both, because two would drift the moment
a sixth form path is added and only half of it is copied. Both halves are
best-effort and run after the lead is written — a bounced address must never
turn a captured lead into an error the visitor sees.

Notifications are additive to Settings → Lead routing, not a replacement:
routing decides which advisor *owns* the lead, the list is "also tell these
people". Empty by default, which costs one column read on a round trip the
submission log is making anyway.

**Mappings** are how a field's answer finds its column. `name`, `email`,
`phone`, `message`, `intent`, `timeline`, `development_id` and friends land in
`enquiries`. Everything mapped `custom` rides in `form_submissions.data` **and**
is appended to the brief as `Label: value`, so a question added in the CMS this
morning is legible in the advisor's inbox this afternoon.

`form_submissions.data` also carries `_labels`, a snapshot of how each question
read at the time. Renaming a question next month must not silently relabel the
answers people already gave to the old one.

## When the page knows more than the visitor typed

A form sitting under a tool has context no field can hold. The mortgage
pre-approval form is the case: the advisor needs the price, deposit, loan,
term, rate and monthly the visitor spent five minutes arriving at, and asking
them to retype it is how you lose the lead.

That travels as `scenario` on `FormSubmitContext`, and reaches the brief as the
`{scenario}` token in `briefPrefix` — alongside `{project}` and `{reference}`,
which do the same job for the development and property dialogs. It also lands
in `form_submissions.data._scenario`, labelled, so Responses is as complete as
the inbox.

Two things it is deliberately not:

- **Not a pre-filled message box.** A prefill is frozen when the form mounts.
  Nudge the price slider afterwards and the brief and the screen disagree —
  and re-keying the form to resync it would wipe a half-typed email address.
  A context value is read at the moment the button is pressed.
- **Not a field.** An editor who deleted it would turn every mortgage lead
  into "someone wants a mortgage", and the manager gives no hint that the
  field was load-bearing. `locked` would prevent the deletion but still show a
  box the visitor can't usefully edit.

The value is trimmed to 800 characters server-side, because a hand-rolled POST
reaches this the same way the page does.

## Branching: questions that depend on answers

A field may carry a `showWhen` — "ask this only when *that* field answers one of
these". The Buy hero's brief is the only form using it today: **Property
Purpose** decides whether the visitor is offered apartments or retail space,
and whether they are asked about bedrooms at all.

```ts
field("bedrooms", "Number of Bedrooms", "select", "custom", {
  options: options(["1 Bedroom", "1"], …),
  showWhen: { field: "purpose", values: ["residential"] },
})
```

Three rules, and each is enforced where it can actually be seen:

| rule | enforced in |
|---|---|
| the shape is `{field, values}` with at least one value | `0098`'s column check |
| the target exists, comes **earlier**, and has fixed answers | `formSaveSchema` — only it holds the whole list |
| an unreachable condition hides the field | `activeFields` — never "shows it anyway" |

`activeFields(form, values)` is the list the renderer draws, the schema
validates and the submission is read through. All three use it, so a visitor is
never held to a question they weren't shown — and an answer given *before* they
changed their mind (bedrooms, then switching to commercial) is dropped in
`normaliseSubmission` rather than filed on the lead.

The two property-type dropdowns are **separate fields sharing a label**, not one
field whose options swap. An editor adding "Duplex" shouldn't have to work out
which half of a merged list they're in, and only one is ever on screen.

## Range sliders

`type: "range"` renders the dual-handle slider the search filters use, and
submits one string: `"min:max"`, either side blank for open-ended. That is
exactly the shape a `budget_band` pill's option value already carried, so both
land in `enquiries.budget_min` / `budget_max` through one code path — a form can
swap pills for a slider without migrating the answers it already collected.

- `min` / `max` are the ends of the scale, `step` the drag increment, `unit` the
  prefix on each number ("AED 2,500,000"). All four are editable.
- Both handles parked at the ends is a **blank** answer, not `0:0` — no budget
  on the lead, no budget line in the brief.
- `formatRangeLabel` is what a human reads: `Up to AED 3,000,000`,
  `AED 8,000,000+`, `AED 4,000,000 – AED 8,000,000`.

## Adding a form

1. Declare it in `lib/forms/registry.ts` with the fields the page renders
   **today**, string for string. `lib/forms/registry.test.ts` holds you to it.
2. Render it with `<ManagedForm formKey="…" />` (server components) or resolve
   it with `getForm(key)` and pass the result to `<FormRenderer form={…} />`
   (client dialogs — a `ResolvedForm` is plain JSON).
3. Gate the surrounding card on `form.enabled` where the form is the only thing
   in it; a heading over an empty box is worse than no section.

No migration is needed — the manager lists, resolves and records it as soon as
the registry entry exists.

## `control: "full"` vs `"copy"`

`full` means the public component is `FormRenderer`, so fields, types and order
are live. `copy` means the component draws its own inputs — a two-step wizard,
an OTP gate, a single locked box — so the manager manages visibility, wording
and responses, and shows the field list read-only rather than offering controls
that would do nothing. Today: the sell wizard, the valuation gate, the
newsletter box and the floor-plan gate. See `docs/FOLLOWUPS.md`.
