"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { stripIsolates } from "@/lib/i18n/bidi";
import type { Locale } from "@/lib/i18n/locales";
import type { SectionValues } from "@/lib/master-pages";
import {
  getCard,
  previewCardText,
  type CardKey,
} from "@/lib/master-pages/cards";
import type {
  CardAdvisor,
  CardProject,
  CardProjectTokens,
} from "@/lib/queries/cards";
import { LeadAdvisorBanner } from "@/app/[locale]/(public)/developments/[slug]/_components/lead-advisor-banner";
import { fieldCls } from "../../../_fields/types";

export type PreviewProject = Pick<
  CardProject,
  "slug" | "name" | "published" | "tokens" | "advisor" | "values"
>;

/** The width the card is laid out at before it is scaled to fit. */
const CANVAS = 1200;

/**
 * Stand-in for a project nobody is assigned to. On the live page that project
 * shows NO advisor card at all — the banner is dropped rather than filled with
 * an invented person — so the preview says so and draws the words around a
 * neutral placeholder instead.
 */
const PLACEHOLDER: CardAdvisor = {
  user_id: "preview",
  slug: "",
  display_name: "Advisor name",
  title: "Title, from their team record",
  photo_url: null,
  phone: null,
  whatsapp: null,
};

/** What the tokens read as when there is no project to borrow them from. */
const PLACEHOLDER_TOKENS: CardProjectTokens = {
  name: "Project name",
  area: "Area",
  developer: "Developer",
  plan: "Payment plan",
  advisor: PLACEHOLDER.display_name,
  advisor_first: "Advisor",
};

/**
 * The real `LeadAdvisorBanner`, fed the editor's unsaved wording and one real
 * project's name and advisor. Not a drawing of the card — the component the
 * project page renders, so a change to its layout shows up here without
 * anyone remembering to update a mock.
 *
 * Laid out at desktop width and scaled down to fit: the banner's columns key
 * off the VIEWPORT's breakpoints, so squeezing it into a narrower box would
 * show a desktop layout that no desktop visitor ever sees.
 */
export function AdvisorCardPreview({
  cardKey,
  values,
  projects,
}: {
  cardKey: CardKey;
  values: SectionValues;
  projects: PreviewProject[];
}) {
  const card = getCard(cardKey);
  const initial =
    projects.find((p) => p.published && p.advisor) ?? projects[0] ?? null;
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [locale, setLocale] = useState<Locale>("en");
  const [withOverrides, setWithOverrides] = useState(true);

  const project = projects.find((p) => p.slug === slug) ?? initial;
  const advisor = project?.advisor?.[locale] ?? null;
  const tokens = project?.tokens[locale] ?? PLACEHOLDER_TOKENS;

  const text = useMemo(
    () =>
      card
        ? previewCardText(
            card,
            values,
            withOverrides ? (project?.values ?? null) : null,
            locale,
            tokens,
          )
        : null,
    [card, values, withOverrides, project, locale, tokens],
  );
  if (!card || !text) return null;

  const read = (field: string) => text(field);
  const eyebrow = read("eyebrow");
  const heading = read("heading");
  const intro = withOverrides ? read("intro") : { text: null, source: null };
  const quote = read("quote");
  const call = read("call_label");
  const visit = read("visit_label");
  const message = read("visit_message");

  const overridden = [
    ["Eyebrow", eyebrow],
    ["Heading", heading],
    ["Pull quote", quote],
    ["Call button", call],
    ["Site-visit button", visit],
    ["Site-visit message", message],
  ].filter(([, t]) => (t as { source: string | null }).source === "project");

  const shown = advisor ?? PLACEHOLDER;
  // The live page hides a button whose number the advisor has not given.
  // The preview always draws both — hiding the label an editor is typing
  // would make the preview useless for exactly that field — and says which
  // one a visitor would not see.
  const agent = {
    ...shown,
    brn: null,
    bio: null,
    email: null,
    phone: shown.phone ?? "0",
    whatsapp: shown.whatsapp ?? "0",
  };
  const hiddenButtons = [
    !shown.phone ? "Call" : null,
    !shown.whatsapp ? "Book site visit" : null,
  ].filter(Boolean);

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface">
      <div className="flex flex-wrap items-end gap-3 border-b border-bz-border px-4 py-3">
        <div className="me-auto">
          <h2 className="text-[13.5px] font-medium">Live preview</h2>
          <p className="text-[11.5px] text-bz-muted">
            Updates as you type. Nothing is published until you save.
          </p>
        </div>
        {projects.length > 0 ? (
          <label className="flex flex-col gap-1 text-[11px] text-bz-muted">
            Project
            <select
              className={cn(fieldCls, "w-[240px]")}
              value={project?.slug ?? ""}
              onChange={(e) => setSlug(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                  {p.published ? "" : " (draft)"}
                  {p.advisor ? "" : " — no advisor"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div
          role="group"
          aria-label="Preview language"
          className="inline-flex rounded border border-bz-border overflow-hidden text-[12px]"
        >
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={cn(
                "h-8 px-3",
                locale === l
                  ? "bg-bz-ink text-white"
                  : "bg-bz-bg text-bz-ink-2 hover:text-bz-ink",
              )}
            >
              {l === "en" ? "EN" : "العربية"}
            </button>
          ))}
        </div>
        {projects.length > 0 ? (
          <label className="inline-flex items-center gap-1.5 h-8 text-[12px] text-bz-ink-2">
            <input
              type="checkbox"
              checked={withOverrides}
              onChange={(e) => setWithOverrides(e.target.checked)}
            />
            Include this project&apos;s own wording
          </label>
        ) : null}
      </div>

      <ScaledCanvas>
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          lang={locale}
          // A picture of the card, not a working one: its name links to the
          // advisor's profile and its buttons dial and message.
          inert
          className="bg-bz-bg"
        >
          <LeadAdvisorBanner
            agent={agent}
            developmentName={tokens.name}
            eyebrow={eyebrow.text}
            heading={heading.text}
            intro={intro.text}
            quote={quote.text}
            callLabel={call.text}
            visitLabel={visit.text}
            visitMessage={message.text}
          />
        </div>
      </ScaledCanvas>

      <div className="flex flex-col gap-1.5 border-t border-bz-border px-4 py-3 text-[12px] text-bz-ink-2">
        <p>
          <span className="text-bz-muted">WhatsApp opens holding: </span>
          <span dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
            {stripIsolates(message.text ?? "")}
          </span>
        </p>
        {overridden.length > 0 ? (
          <p className="text-[oklch(0.45_0.12_60)]">
            {project?.name} has its own wording for{" "}
            {overridden.map(([label]) => label).join(", ")} — that is what its
            page shows, and editing those fields here will not change it. See
            “Projects with their own wording” below.
          </p>
        ) : null}
        {!advisor ? (
          <p className="text-bz-muted">
            {project
              ? `${project.name} has no advisor assigned, so its page shows no advisor card. Previewing around a placeholder.`
              : "No projects yet — previewing around a placeholder."}
          </p>
        ) : hiddenButtons.length > 0 ? (
          <p className="text-bz-muted">
            {advisor.display_name} has no{" "}
            {hiddenButtons.length === 2
              ? "phone or WhatsApp number"
              : hiddenButtons[0] === "Call"
                ? "phone number"
                : "WhatsApp number"}{" "}
            on their team record, so the live page leaves out the{" "}
            {hiddenButtons.join(" and ")} button
            {hiddenButtons.length === 2 ? "s" : ""}. Both are drawn here so
            their labels can be checked.
          </p>
        ) : null}
        {locale === "ar" ? (
          <p className="text-bz-muted">
            The live Arabic page sets this in the site&apos;s Arabic typeface;
            this screen uses your browser&apos;s. Unit counts (
            <span className="mono">{"{available}"}</span>,{" "}
            <span className="mono">{"{total}"}</span>) are filled in on the live
            page only.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Lay children out at `CANVAS` px wide and scale them to the box. */
function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const s = Math.min(1, o.clientWidth / CANVAS);
      setScale(s);
      setHeight(i.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      className="overflow-hidden"
      style={{ height: height ?? undefined }}
    >
      <div
        ref={inner}
        style={{
          width: CANVAS,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
