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

Every path also writes a `form_submissions` row via `recordFormSubmission`, so
Responses is complete regardless of which component drew the form.

**Mappings** are how a field's answer finds its column. `name`, `email`,
`phone`, `message`, `intent`, `timeline`, `development_id` and friends land in
`enquiries`. Everything mapped `custom` rides in `form_submissions.data` **and**
is appended to the brief as `Label: value`, so a question added in the CMS this
morning is legible in the advisor's inbox this afternoon.

`form_submissions.data` also carries `_labels`, a snapshot of how each question
read at the time. Renaming a question next month must not silently relabel the
answers people already gave to the old one.

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
