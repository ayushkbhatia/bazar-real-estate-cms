"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { FormGroup } from "@/lib/forms/types";
import type { ContentAssetStatus } from "@/lib/schemas/content-asset";
import { assignFormReply } from "./_actions";

export type MappingRow = {
  key: string;
  name: string;
  surface: string;
  path: string;
  group: FormGroup;
  assignable: boolean;
  why: string | null;
  defaultEmail: { key: string; label: string; subject: string };
  assigned: { assetId: string; assetName: string; status: ContentAssetStatus; trashed: boolean } | null;
};

export type ReplyOption = {
  id: string;
  name: string;
  status: ContentAssetStatus;
  usedBy: number;
};

/**
 * Every public form, and the email its visitor receives.
 *
 * One row per form rather than per page: two boxes on /buy answer different
 * questions and may deserve different replies, and collapsing them would hide
 * exactly the choice this screen exists to offer.
 */
export function FormReplyMapping({
  rows,
  replies,
  canWrite,
  groups,
  groupLabels,
}: {
  rows: MappingRow[];
  replies: ReplyOption[];
  canWrite: boolean;
  groups: FormGroup[];
  groupLabels: Record<FormGroup, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  function assign(formKey: string, value: string) {
    setBusy(formKey);
    start(async () => {
      const result = await assignFormReply(formKey, value === "" ? null : value);
      setBusy(null);
      if (result.status === "error") toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  const publishable = replies.filter((r) => r.status === "published");

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const groupRows = rows.filter((r) => r.group === group);
        if (groupRows.length === 0) return null;
        return (
          <section key={group} className="flex flex-col gap-2">
            <h2 className="serif text-[22px] leading-tight">{groupLabels[group]}</h2>
            <div className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-bz-border text-[11px] uppercase tracking-wide text-bz-muted">
                    <th className="text-start font-medium px-4 py-2.5 w-[38%]">Form</th>
                    <th className="text-start font-medium px-4 py-2.5">The visitor receives</th>
                    <th className="text-end font-medium px-4 py-2.5 w-[40px]" />
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => (
                    <tr key={row.key} className="border-b border-bz-border last:border-0 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-bz-muted">
                          <span>{row.surface}</span>
                          <Link
                            href={row.path}
                            target="_blank"
                            className="mono inline-flex items-center gap-1 hover:text-bz-ink"
                          >
                            {row.path}
                            <ExternalLink size={10} strokeWidth={1.8} />
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.assignable ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <select
                                aria-label={`Reply for ${row.name}`}
                                disabled={!canWrite || busy === row.key}
                                value={row.assigned?.assetId ?? ""}
                                onChange={(e) => assign(row.key, e.target.value)}
                                className="h-7 max-w-[280px] rounded border border-bz-border bg-bz-bg px-2 text-[12.5px] disabled:opacity-60"
                              >
                                <option value="">
                                  Bazar&apos;s {row.defaultEmail.label.toLowerCase()}
                                </option>
                                {replies.map((r) => (
                                  <option key={r.id} value={r.id} disabled={r.status !== "published"}>
                                    {r.name}
                                    {r.status === "published" ? "" : " (draft)"}
                                  </option>
                                ))}
                              </select>
                              {busy === row.key ? (
                                <Loader2 size={13} className="animate-spin text-bz-muted" />
                              ) : null}
                            </div>
                            <div className="text-[11.5px] text-bz-muted">
                              {row.assigned && row.assigned.status === "published" && !row.assigned.trashed ? (
                                <>Subject line comes from “{row.assigned.assetName}”.</>
                              ) : row.assigned ? (
                                <span className="text-[oklch(0.45_0.1_60)]">
                                  “{row.assigned.assetName}” is {row.assigned.trashed ? "in the trash" : "a draft"}, so
                                  the acknowledgement is still what sends.
                                </span>
                              ) : (
                                <>“{row.defaultEmail.subject}”</>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/admin/content-assets/emails/${row.defaultEmail.key}`}
                              className="inline-flex items-center gap-1.5 text-bz-ink underline-offset-2 hover:underline"
                            >
                              <Settings2 size={12} strokeWidth={1.8} />
                              {row.defaultEmail.label}
                            </Link>
                            <span className="inline-flex gap-1.5 text-[11.5px] text-bz-muted max-w-[52ch]">
                              <Info size={12} strokeWidth={1.8} className="shrink-0 mt-0.5" />
                              {row.why}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          href={`/admin/forms/${row.key}`}
                          title="Open in Forms"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-bz-muted hover:text-bz-ink hover:bg-bz-surface-2"
                        >
                          <Settings2 size={13} strokeWidth={1.8} />
                          <span className="sr-only">Open {row.name} in Forms</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {canWrite && replies.length > 0 && publishable.length === 0 ? (
        <p className="text-[12.5px] text-bz-muted">
          Every reply you have written is still a draft. Publish one to make it
          selectable above.
        </p>
      ) : null}
      {!canWrite ? (
        <p className="text-[12.5px] text-bz-muted">
          You can see which email each form sends. Changing it is for admins,
          editors and marketing.
        </p>
      ) : null}
    </div>
  );
}
