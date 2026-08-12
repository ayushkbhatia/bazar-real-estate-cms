"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatPriceAED,
  propertyUrl,
} from "@/lib/queries/property-utils";
import type { ListingRow } from "@/lib/queries/properties";
import {
  BULK_SELECTION_CAP,
  BULK_SELECTION_PARAM,
  deselectVisible,
  headerCheckboxState,
  parseSelectedParam,
  selectAllVisible,
  selectionFromIterable,
  serializeSelection,
  toggleId,
} from "@/lib/bulk/selection";

const STATUS_STYLES: Record<ListingRow["status"], string> = {
  draft: "bg-bz-surface-2 text-bz-ink-2",
  in_review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  off_market: "bg-bz-surface-3 text-bz-muted",
  archived: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};
const STATUS_LABELS: Record<ListingRow["status"], string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  off_market: "Off-market",
  archived: "Archived",
};

function StatusPill({ status }: { status: ListingRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const selectedParser = parseAsString.withDefault("");

export function PropertiesTable({ rows }: { rows: ListingRow[] }) {
  const [rawSelected, setRawSelected] = useQueryState(
    BULK_SELECTION_PARAM,
    selectedParser,
  );

  const selected = useMemo(
    () => selectionFromIterable(parseSelectedParam(rawSelected)),
    [rawSelected],
  );

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const headerState = headerCheckboxState(selected, visibleIds);

  function commit(next: Set<string>) {
    const serialized = serializeSelection(next);
    void setRawSelected(serialized);
  }

  function onToggleHeader() {
    if (headerState === "all") commit(deselectVisible(selected, visibleIds));
    else commit(selectAllVisible(selected, visibleIds));
  }

  function onToggleRow(id: string) {
    commit(toggleId(selected, id));
  }

  const atCap = selected.size >= BULK_SELECTION_CAP;
  const visibleCount = visibleIds.length;

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px]">
              <HeaderCheckbox
                state={headerState}
                onToggle={onToggleHeader}
                disabled={visibleCount === 0}
                label={
                  headerState === "all"
                    ? `Deselect ${visibleCount} on this page`
                    : `Select ${visibleCount} on this page`
                }
              />
            </TableHead>
            <TableHead className="w-[32%]">Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Beds</TableHead>
            <TableHead>Built-up</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Listed</TableHead>
            <TableHead className="text-end">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-16 text-bz-muted">
                No properties yet — sign in as a staff user and run the
                seed to populate.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isSelected = selected.has(row.id);
              const disabled = !isSelected && atCap;
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(isSelected && "bg-bz-surface-2")}
                >
                  <TableCell className="w-[44px]">
                    <RowCheckbox
                      checked={isSelected}
                      disabled={disabled}
                      onToggle={() => onToggleRow(row.id)}
                      label={`Select ${row.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/properties/${row.id}`}
                      className="block hover:text-bz-accent transition-colors"
                    >
                      <div className="font-medium truncate max-w-[42ch]">
                        {row.title}
                      </div>
                      <div className="mono text-[11px] text-bz-muted mt-0.5">
                        {row.reference}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-bz-ink-2 capitalize">
                    {row.mode.replace("_", "-")}
                  </TableCell>
                  <TableCell>{row.beds}</TableCell>
                  <TableCell className="mono">
                    {row.built_up_ft2 ? `${row.built_up_ft2}` : "—"}
                  </TableCell>
                  <TableCell className="mono font-medium">
                    {formatPriceAED(row.price_aed)}
                  </TableCell>
                  <TableCell className="text-bz-ink-2">
                    {row.areas?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-bz-muted text-[12px]">
                    {relativeDate(row.published_at ?? row.created_at)}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.status === "published" ? (
                      <Link
                        href={propertyUrl(row)}
                        className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span className="text-[12px] text-bz-muted-2">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function HeaderCheckbox({
  state,
  onToggle,
  disabled,
  label,
}: {
  state: "none" | "all" | "some";
  onToggle: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={state === "all"}
      ref={(el) => {
        if (el) el.indeterminate = state === "some";
      }}
      onChange={onToggle}
      disabled={disabled}
      className="h-3.5 w-3.5 accent-bz-accent cursor-pointer disabled:cursor-not-allowed"
    />
  );
}

function RowCheckbox({
  checked,
  disabled,
  onToggle,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      title={
        disabled
          ? `Selection is capped at ${BULK_SELECTION_CAP}. Clear some rows first.`
          : undefined
      }
      className="h-3.5 w-3.5 accent-bz-accent cursor-pointer disabled:cursor-not-allowed"
    />
  );
}
