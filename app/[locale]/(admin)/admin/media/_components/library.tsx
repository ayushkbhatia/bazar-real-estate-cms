"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, Info, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MEDIA_STATE_LABELS,
  USAGE_KIND_LABELS,
  summariseUsage,
  type MediaState,
  type MediaUsage,
} from "@/lib/media-usage";
import {
  trashMedia,
  restoreMedia,
  deleteMediaPermanently,
} from "../_actions";
import { MediaUsageBadge } from "./usage-badge";

export type MediaLibraryItem = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  url: string;
  folder: string;
  created_at: string;
  deleted_at: string | null;
  /** Days left before the asset is expected to be purged. */
  daysInTrash: number | null;
  usages: MediaUsage[];
  state: MediaState;
  trashable: { allowed: boolean; reason: string | null };
};

const STATE_STYLES: Record<MediaState, string> = {
  live: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  attached: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  internal: "bg-bz-surface-3 text-bz-muted",
  unused: "bg-bz-surface-2 text-bz-ink-2",
};

export function MediaLibrary({
  items,
  view,
  trashView,
  canDestroy,
}: {
  items: MediaLibraryItem[];
  view: "grid" | "list";
  trashView: boolean;
  canDestroy: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [details, setDetails] = useState<MediaLibraryItem | null>(null);

  function run(
    id: string,
    action: () => Promise<{ status: string; message: string }>,
  ) {
    setBusyId(id);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function onTrash(item: MediaLibraryItem) {
    run(item.id, () => trashMedia(item.id));
  }

  function onRestore(item: MediaLibraryItem) {
    run(item.id, () => restoreMedia(item.id));
  }

  function onDestroy(item: MediaLibraryItem) {
    if (
      !confirm(
        `Permanently delete "${item.filename}"? The file is removed from storage and cannot be recovered.`,
      )
    )
      return;
    run(item.id, () => deleteMediaPermanently(item.id));
  }

  if (items.length === 0) {
    return (
      <div className="bg-bz-surface border border-bz-border rounded-lg p-12 text-center text-bz-muted text-[13.5px]">
        {trashView
          ? "Trash is empty. Unused files you delete land here first."
          : "Nothing matches these filters."}
      </div>
    );
  }

  return (
    <>
      {view === "grid" ? (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden flex flex-col"
            >
              <Thumb item={item} />
              <div className="px-3 py-2.5 flex flex-col gap-1.5 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-[13px] font-medium truncate"
                    title={item.filename}
                  >
                    {item.filename}
                  </span>
                  <StatePill state={item.state} />
                </div>
                <UsageLine item={item} onOpen={() => setDetails(item)} />
                <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-bz-muted">
                  <span>{formatBytes(item.size_bytes)}</span>
                  <span>·</span>
                  <span className="mono">{item.folder}</span>
                  <span className="ms-auto flex items-center gap-1">
                    <RowActions
                      item={item}
                      busy={busyId === item.id}
                      trashView={trashView}
                      canDestroy={canDestroy}
                      onTrash={onTrash}
                      onRestore={onRestore}
                      onDestroy={onDestroy}
                      onDetails={() => setDetails(item)}
                    />
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden">
          <ul className="divide-y divide-bz-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-4 py-2.5 text-[13px]"
              >
                <div className="relative h-11 w-14 flex-shrink-0 rounded overflow-hidden bg-bz-surface-2">
                  {item.mime_type.startsWith("image/") ? (
                    <Image
                      src={item.url}
                      alt={item.filename}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center mono text-[9px] uppercase text-bz-muted">
                      {item.mime_type.split("/")[1] ?? "file"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.filename}</div>
                  <UsageLine item={item} onOpen={() => setDetails(item)} />
                </div>
                <StatePill state={item.state} />
                <span className="mono text-[11px] text-bz-muted w-16 text-end">
                  {formatBytes(item.size_bytes)}
                </span>
                <span className="mono text-[11px] text-bz-muted w-20">
                  {item.folder}
                </span>
                <span className="flex items-center gap-1">
                  <RowActions
                    item={item}
                    busy={busyId === item.id}
                    trashView={trashView}
                    canDestroy={canDestroy}
                    onTrash={onTrash}
                    onRestore={onRestore}
                    onDestroy={onDestroy}
                    onDetails={() => setDetails(item)}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={details !== null}
        onOpenChange={(open) => !open && setDetails(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">{details?.filename}</DialogTitle>
            <DialogDescription>
              {details ? summariseUsage(details.usages) : null}
            </DialogDescription>
          </DialogHeader>
          {details && details.usages.length > 0 ? (
            <ul className="flex flex-col divide-y divide-bz-border text-[13px] max-h-[50vh] overflow-y-auto">
              {details.usages.map((u, i) => (
                <li
                  key={`${u.kind}-${u.id}-${u.role}-${i}`}
                  className="py-2 flex items-center gap-3"
                >
                  <span className="mono text-[10.5px] uppercase tracking-wider text-bz-muted w-24 flex-shrink-0">
                    {USAGE_KIND_LABELS[u.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {u.href ? (
                      <Link
                        href={u.href}
                        className="hover:text-bz-accent inline-flex items-center gap-1"
                      >
                        {u.label}
                        <ExternalLink size={10} />
                      </Link>
                    ) : (
                      u.label
                    )}
                  </span>
                  <span className="text-[11.5px] text-bz-muted">{u.role}</span>
                  <span
                    className={cn(
                      "text-[10.5px] px-1.5 h-5 inline-flex items-center rounded-full",
                      u.live
                        ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                        : "bg-bz-surface-2 text-bz-muted",
                    )}
                  >
                    {u.live ? "Live" : u.internal ? "Internal" : "Not live"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-bz-muted">
              No record references this file. It can be moved to the trash.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Thumb({ item }: { item: MediaLibraryItem }) {
  const isImage = item.mime_type.startsWith("image/");
  return (
    <div className="relative aspect-[4/3] bg-bz-surface-2">
      {isImage ? (
        <Image
          src={item.url}
          alt={item.filename}
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-bz-muted mono text-[11px] uppercase">
          {item.mime_type.split("/")[1] ?? "file"}
        </div>
      )}
      <MediaUsageBadge
        count={item.usages.length}
        title={item.usages.map((u) => `${u.label} — ${u.role}`).join("\n")}
      />
      {item.daysInTrash !== null ? (
        <span className="absolute top-2 start-2 h-5 px-1.5 rounded bg-bz-ink/80 text-bz-bg text-[10px] font-medium inline-flex items-center backdrop-blur">
          In trash {item.daysInTrash}d
        </span>
      ) : null}
    </div>
  );
}

function StatePill({ state }: { state: MediaState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[19px] px-1.5 rounded-full text-[10.5px] font-medium flex-shrink-0",
        STATE_STYLES[state],
      )}
    >
      {MEDIA_STATE_LABELS[state]}
    </span>
  );
}

function UsageLine({
  item,
  onOpen,
}: {
  item: MediaLibraryItem;
  onOpen: () => void;
}) {
  const first = item.usages[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-start text-[11.5px] text-bz-muted hover:text-bz-ink-2 truncate"
      title={item.usages.map((u) => `${u.label} (${u.role})`).join("\n")}
    >
      {first ? (
        <>
          <span className="text-bz-ink-2">{first.label}</span>
          <span> · {first.role}</span>
          {item.usages.length > 1 ? (
            <span> · +{item.usages.length - 1} more</span>
          ) : null}
        </>
      ) : (
        "Not used anywhere"
      )}
    </button>
  );
}

function RowActions({
  item,
  busy,
  trashView,
  canDestroy,
  onTrash,
  onRestore,
  onDestroy,
  onDetails,
}: {
  item: MediaLibraryItem;
  busy: boolean;
  trashView: boolean;
  canDestroy: boolean;
  onTrash: (i: MediaLibraryItem) => void;
  onRestore: (i: MediaLibraryItem) => void;
  onDestroy: (i: MediaLibraryItem) => void;
  onDetails: () => void;
}) {
  if (busy) {
    return (
      <Loader2 size={13} className="animate-spin text-bz-muted" aria-label="Working" />
    );
  }
  return (
    <>
      <IconButton label="Where is this used?" onClick={onDetails}>
        <Info size={13} strokeWidth={1.7} />
      </IconButton>
      {trashView ? (
        <>
          <IconButton label="Restore" onClick={() => onRestore(item)}>
            <RotateCcw size={13} strokeWidth={1.7} />
          </IconButton>
          {canDestroy ? (
            <IconButton
              label="Delete permanently"
              danger
              onClick={() => onDestroy(item)}
            >
              <Trash2 size={13} strokeWidth={1.7} />
            </IconButton>
          ) : null}
        </>
      ) : (
        <IconButton
          label="Move to trash"
          hint={trashLabel(item)}
          disabled={!item.trashable.allowed}
          danger
          onClick={() => onTrash(item)}
        >
          <Trash2 size={13} strokeWidth={1.7} />
        </IconButton>
      )}
    </>
  );
}

/** Tooltip for the trash button. When it's disabled this is the only place the
 *  user learns why, so it names what's holding the file. */
function trashLabel(item: MediaLibraryItem): string {
  if (item.trashable.allowed) return "Move to trash";
  const reason = item.trashable.reason ?? "Can't be deleted.";
  return item.usages.length > 0
    ? `${reason} Used in ${summariseUsage(item.usages)}.`
    : reason;
}

/** Red text + red wash + a soft red glow. Kept as one string so there is never
 *  a second `hover:text-*` competing with it for the same element. */
const DANGER_HOVER =
  "hover:text-[oklch(0.45_0.13_28)] hover:bg-[oklch(0.95_0.05_28)] hover:ring-1 hover:ring-[oklch(0.82_0.08_28)] hover:shadow-[0_0_0_4px_oklch(0.45_0.13_28_/_0.14)] dark:hover:bg-[oklch(0.3_0.08_28)] dark:hover:ring-[oklch(0.45_0.12_28)]";

const NEUTRAL_HOVER = "hover:text-bz-ink hover:bg-bz-surface-2";

function IconButton({
  label,
  hint,
  onClick,
  children,
  disabled,
  danger,
}: {
  /** What the button does — stays constant so the accessible name does too. */
  label: string;
  /** Tooltip text. Falls back to the label; carries the "why not" when disabled. */
  hint?: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  const tooltip = hint ?? label;
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={disabled ? undefined : tooltip}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-6 w-6 text-bz-muted transition-all",
        !disabled && (danger ? DANGER_HOVER : NEUTRAL_HOVER),
        disabled && "opacity-40",
      )}
    >
      {children}
    </Button>
  );

  // A disabled button gets `pointer-events-none` from the button variant, which
  // also swallows its own tooltip — so the one thing the user needs (why can't
  // I delete this?) was the one thing they couldn't read. Hang the explanation
  // on a wrapper that still receives the hover.
  if (disabled) {
    return (
      <span title={tooltip} className="inline-flex cursor-not-allowed">
        {button}
      </span>
    );
  }
  return button;
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
