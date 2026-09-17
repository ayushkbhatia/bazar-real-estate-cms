import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { cn } from "@/lib/utils";
import {
  listFormAssignments,
  listFormReplies,
  assignmentCounts,
} from "@/lib/queries/content-assets";
import { getStaffRole } from "@/lib/auth";
import { SYSTEM_ASSETS } from "@/lib/content-assets/system";
import { readEmailBrand } from "@/lib/content-assets/system-resolve";
import { renderGallery } from "@/lib/content-assets/system-emails";
import { allForms, formEmailRouting } from "@/lib/content-assets/usage";
import { FORM_GROUP_LABELS, type FormGroup } from "@/lib/forms/types";
import { LangToggle, langFrom, withLang } from "../_lang-toggle";
import { FormReplyMapping } from "./_mapping";
import { NewReplyButton } from "./_new-reply";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FormRepliesPage({ searchParams }: PageProps) {
  const lang = langFrom(await searchParams);
  const [replies, assignments, role, brand] = await Promise.all([
    listFormReplies(),
    listFormAssignments(),
    getStaffRole(),
    readEmailBrand(),
  ]);
  const live = renderGallery({}, brand, lang);
  const counts = assignmentCounts(assignments);
  const forms = allForms();

  const groups: FormGroup[] = ["master", "sub", "dialog"];
  const rows = forms.map((def) => {
    const routing = formEmailRouting(def);
    const assigned = assignments[def.key] ?? null;
    return {
      key: def.key,
      name: def.name,
      surface: def.surface,
      path: def.path,
      group: def.group,
      assignable: routing.assignable,
      why: routing.assignable ? null : routing.why,
      defaultEmail: {
        key: routing.defaultEmail,
        label: SYSTEM_ASSETS[routing.defaultEmail].label,
        subject: live[routing.defaultEmail].live.subject,
      },
      assigned,
    };
  });

  return (
    <CmsShell
      title="Form replies"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href={withLang("/admin/content-assets", lang)} className="hover:text-bz-ink">
            Content assets
          </Link>
          <ChevronRight size={11} />
          <span>Form replies</span>
        </span>
      }
      primary={
        role === "admin" || role === "editor" || role === "marketing" ? (
          <NewReplyButton />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <LangToggle
            lang={lang}
            hrefFor={(l) => withLang("/admin/content-assets/replies", l)}
          />
          <span className="text-[12px] text-bz-muted">
            {lang === "ar"
              ? "Showing the Arabic each form sends. A reply with no Arabic sends its English."
              : "The assignment is the same in both languages — only the wording differs."}
          </span>
        </div>

        <p className="text-[13px] text-bz-muted max-w-[75ch]">
          What a visitor is emailed after they fill in each form on the site.
          Every form sends Bazar&apos;s acknowledgement unless you write a reply
          and point the form at it — so a brochure request can be answered
          differently from a mortgage enquiry, without a developer.
        </p>

        <FormReplyMapping
          rows={rows}
          replies={replies.map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            usedBy: (counts[r.id] ?? []).length,
          }))}
          canWrite={role === "admin" || role === "editor" || role === "marketing"}
          groupLabels={FORM_GROUP_LABELS}
          groups={groups}
        />

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="serif text-[22px] leading-tight">Your replies</h2>
              <p className="text-[12.5px] text-bz-muted mt-0.5">
                Written once, assignable to as many forms as you like.
              </p>
            </div>
          </div>
          {replies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-bz-border bg-bz-surface px-5 py-8 text-center">
              <p className="text-[13px] text-bz-ink-2">
                No replies yet. Every form sends Bazar&apos;s acknowledgement.
              </p>
              <p className="text-[12px] text-bz-muted mt-1">
                Write one and it starts as a draft — nothing changes until you
                publish it and point a form at it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {replies.map((r) => {
                const used = counts[r.id] ?? [];
                return (
                  <Link
                    key={r.id}
                    href={withLang(`/admin/content-assets/replies/${r.id}`, lang)}
                    className="group rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-border-strong transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <h3 className="font-medium text-[14px] leading-snug group-hover:text-bz-accent transition-colors">
                        {r.name}
                      </h3>
                      <span
                        className={cn(
                          "ms-auto shrink-0 inline-flex items-center h-[20px] px-1.5 rounded-full text-[10.5px] font-medium",
                          r.status === "published"
                            ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                            : "bg-bz-surface-2 text-bz-ink-2",
                        )}
                      >
                        {r.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-bz-muted truncate">
                      {r.subject}
                    </p>
                    <p className="mt-2 text-[12px] text-bz-ink-2">
                      {used.length === 0
                        ? "Not assigned to a form yet"
                        : `Replies for ${used.length} ${used.length === 1 ? "form" : "forms"}`}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-bz-muted">
                      {r.subject_ar?.trim() && r.body_ar?.trim()
                        ? "English and Arabic"
                        : "English only — Arabic leads get it in English"}
                    </p>
                    {r.deleted_at ? (
                      <p className="mt-1 text-[11.5px] text-bz-muted">In the trash</p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </CmsShell>
  );
}
