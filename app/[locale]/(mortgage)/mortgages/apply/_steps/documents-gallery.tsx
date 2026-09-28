"use client";

import { useTranslations } from "next-intl";
import { MB, type DocKind } from "@/lib/mortgage-requests/documents";
import { formatMonthYear } from "@/lib/mortgage-requests/format";
import { completion, rowView, type UploadItem } from "@/lib/mortgage-requests/client/upload-queue";
import { ConsentCheckbox, DocumentUploadRow } from "../../../_components/documents";
import { FlowActions } from "../../../_components/flow-actions";
import { FlowPage } from "../../../_components/flow-page";
import { NoteRow, RailCard } from "../../../_components/primitives";
import { richTags } from "../../../_components/rich";
import { FlowHeading, NextSteps } from "../../../_components/steps";
import { SelectionSummary } from "../../../_components/summary";

const file = (kind: DocKind, name: string, mb: number, extra: Partial<UploadItem> = {}): UploadItem => ({
  localId: name,
  kind,
  name,
  sizeBytes: Math.round(mb * MB),
  mime: name.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
  stage: "ready",
  loaded: Math.round(mb * MB),
  fileId: name,
  ...extra,
});

/** The files W6's PNG shows (docs/mortgage/frontend/W6-documents-business-owner, "What the PNG shows"). */
const W6_FILES: UploadItem[] = [
  file("emirates_id", "emirates-id-front.jpg", 1.8),
  file("emirates_id", "emirates-id-back.jpg", 1.6),
  file("passport", "passport-photo-page.pdf", 3.1, { stage: "uploading", loaded: 2 * MB }),
  file("trade_license", "trade-license-scan.pdf", 14.8, {
    stage: "error",
    error: { code: "too_large", sizeBytes: Math.round(14.8 * MB), limitBytes: 10 * MB },
  }),
  file("bank_statements_12m", "statement-sep-nov-2025.pdf", 6.4),
  file("bank_statements_12m", "statement-dec-feb-2026.pdf", 5.9),
  file("bank_statements_12m", "statement-mar-may-2026.pdf", 6.1),
];
const KINDS: DocKind[] = ["emirates_id", "passport", "trade_license", "bank_statements_12m"];
const noop = () => undefined;

export function DocumentsGallery() {
  const t = useTranslations("mortgage");
  const done = completion(KINDS, W6_FILES);
  return (
    <FlowPage
      step={2}
      last="documents"
      rail={
        <>
          <RailCard title={t("common.whatHappensNext")}>
            <NextSteps
              items={[
                t.rich("preNext.review", richTags),
                t.rich("preNext.price", richTags),
                t.rich("preNext.contact", richTags),
              ]}
            />
          </RailCard>
          <RailCard soft>
            <NoteRow glyph="shield" title={t("security.title")}>
              {t("security.body")}
            </NoteRow>
          </RailCard>
        </>
      }
    >
      <SelectionSummary
        label={t("selections.label")}
        chips={[t("selections.service.preApproval"), t("employment.businessOwner.title"), t("residency.expat.title")]}
        action={{ label: t("selections.edit"), href: "/mortgages/apply" }}
      />
      <FlowHeading eyebrow={t("docs.eyebrow")} title={t("w6.title")} lede={t("docs.lede")} />
      <div className="mt-9 flex flex-col gap-3">
        {KINDS.map((kind) => (
          <DocumentUploadRow
            key={kind}
            kind={kind}
            view={rowView(kind, W6_FILES)}
            note={
              kind === "bank_statements_12m"
                ? t("docs.monthsRange", { from: formatMonthYear("2025-09"), to: formatMonthYear("2026-08") })
                : undefined
            }
            onPick={noop}
            onCancel={noop}
            onRemove={noop}
            onRetry={noop}
            canRetry={() => false}
          />
        ))}
      </div>
      <ConsentCheckbox checked onChange={noop} label={t("consent.label")} pending={t("consent.pending")} />
      <FlowActions
        backHref="/mortgages/apply/details"
        note={
          <>
            {t.rich("docs.note.progress", { ...richTags, ready: done.ready, total: done.total })} ·{" "}
            {t("docs.note.attention", { count: done.attention })}
          </>
        }
        noteId="gallery-note"
        cta={t("docs.cta")}
        disabled
        onCta={noop}
      />
    </FlowPage>
  );
}
