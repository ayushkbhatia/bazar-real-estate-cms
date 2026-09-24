"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveSalesforceListing,
  saveSalesforceMapping,
  setSalesforceListingHidden,
  syncSalesforceListingsNow,
  updateListingSyncSettings,
  type ActionResult,
} from "./_actions";

function report(res: ActionResult) {
  if (res.status === "ok") toast.success(res.message);
  else toast.error(res.message);
}

const BUTTON =
  "h-7 px-2.5 rounded-md border border-bz-border bg-bz-bg text-[11.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors disabled:opacity-50";
const PRIMARY =
  "h-7 px-3 rounded-md bg-bz-ink text-bz-bg text-[11.5px] hover:opacity-90 transition-opacity disabled:opacity-50";

export function SyncNowButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={PRIMARY}
      onClick={() => start(async () => report(await syncSalesforceListingsNow()))}
    >
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}

export function SettingsSwitches({
  paused,
  autoPublish,
}: {
  paused: boolean;
  autoPublish: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className={BUTTON}
        onClick={() =>
          start(async () => report(await updateListingSyncSettings({ paused: !paused })))
        }
      >
        {paused ? "Resume sync" : "Pause sync"}
      </button>
      <button
        type="button"
        disabled={pending}
        className={BUTTON}
        onClick={() => {
          if (
            !autoPublish &&
            !window.confirm(
              "Turn on auto-publish? A Salesforce listing that passes every check will go live on the website without anyone approving it.",
            )
          ) {
            return;
          }
          start(async () =>
            report(await updateListingSyncSettings({ autoPublish: !autoPublish })),
          );
        }}
      >
        {autoPublish ? "Turn off auto-publish" : "Turn on auto-publish"}
      </button>
    </div>
  );
}

export function ListingButtons({
  sfListingId,
  state,
}: {
  sfListingId: string;
  state: string;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) => start(async () => report(await fn()));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state === "awaiting_approval" ? (
        <button
          type="button"
          disabled={pending}
          className={PRIMARY}
          onClick={() => run(() => approveSalesforceListing(sfListingId))}
        >
          Approve
        </button>
      ) : null}
      {state === "hidden" ? (
        <button
          type="button"
          disabled={pending}
          className={BUTTON}
          onClick={() => run(() => setSalesforceListingHidden(sfListingId, false))}
        >
          Allow on website
        </button>
      ) : state === "live" || state === "held" || state === "awaiting_approval" ? (
        <button
          type="button"
          disabled={pending}
          className={BUTTON}
          onClick={() => run(() => setSalesforceListingHidden(sfListingId, true))}
        >
          Hide from website
        </button>
      ) : null}
    </div>
  );
}

export function MappingForm({
  kind,
  source,
  label,
  options,
  count,
}: {
  kind: "location" | "developer" | "agent";
  /** What is saved as the mapping's source — the raw CRM value, or `sf:<id>`
   *  for an agent with no email. */
  source: string;
  /** What the row shows. */
  label: string;
  options: { id: string; label: string }[];
  count: number;
}) {
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  const noun = kind === "location" ? "area" : kind === "developer" ? "developer" : "staff member";
  return (
    <form
      className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 py-2.5 border-b border-bz-border last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!target) return;
        start(async () => report(await saveSalesforceMapping({ kind, source, targetId: target })));
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-bz-ink break-words">{label}</div>
        <div className="text-[11px] text-bz-muted">
          {count} listing{count === 1 ? "" : "s"} waiting
        </div>
      </div>
      <select
        aria-label={`Map "${label}" to a ${noun}`}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="h-8 w-full md:w-[280px] rounded-md border border-bz-border bg-bz-bg px-2 text-[12.5px] text-bz-ink"
      >
        <option value="">Choose a {noun}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending || !target} className={PRIMARY}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
