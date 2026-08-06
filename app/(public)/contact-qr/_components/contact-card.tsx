"use client";

import * as React from "react";
import Image from "next/image";
import {
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Smartphone,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { SocialIcon } from "./social-icons";
import styles from "./contact-card.module.css";

/**
 * The /contact-qr card.
 *
 * A digital business card: one screen, one primary action ("Add to Contacts",
 * which downloads a vCard), and a row per way of reaching us. Client-side only
 * because of the EN/AR toggle — the numbers, links and address are identical
 * in both languages, so switching flips `dir` and swaps eight labels rather
 * than fetching a translated page.
 */

export type Lang = "en" | "ar";

/** A string in both languages. The server fills `ar` with `en` when blank. */
export type Bilingual = { en: string; ar: string };

export type RowKind =
  | "mobile"
  | "landline"
  | "whatsapp"
  | "email"
  | "website"
  | "office";

export type ContactRow = {
  kind: RowKind;
  label: Bilingual;
  /** Only the office address actually differs between the two. */
  value: Bilingual;
  href: string | null;
  /** Opens outside the page — WhatsApp, the website. */
  external?: boolean;
  testId?: string;
};

/** Which of the card's three stacks render, and in what order. */
export type CardBlock = "card" | "details" | "follow";

export type ContactCardProps = {
  blocks: CardBlock[];
  /** Not drawn on the card — it is the logo's alt text and the saved contact's name. */
  name: string;
  /** Always set: the CMS image when one is uploaded, the bundled logo otherwise. */
  logoUrl: string;
  logoAlt: string;
  tagline: Bilingual;
  saveLabel: Bilingual;
  /** The .vcf route. */
  vcardHref: string;
  vcardFilename: string;
  rows: ContactRow[];
  followLabel: Bilingual;
  socials: { network: string; href: string }[];
  mapLabel: Bilingual;
  mapHref: string | null;
  footerNote: Bilingual;
};

const ROW_ICON: Record<RowKind, LucideIcon> = {
  mobile: Smartphone,
  landline: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  website: Globe,
  office: MapPin,
};

function pick(value: Bilingual, lang: Lang): string {
  return lang === "ar" ? value.ar : value.en;
}

/** The browser's language never changes mid-visit, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};
const detectLang = (): Lang =>
  /^ar\b/i.test(navigator.language) ? "ar" : "en";
const serverLang = (): Lang => "en";

export function ContactCard(props: ContactCardProps) {
  // Arabic-locale phones open on the Arabic face. Read through
  // useSyncExternalStore rather than an effect: the page is statically
  // rendered, so the server has no locale to read, and this is the one shape
  // that lets the markup hydrate as English and then correct itself without a
  // cascading render.
  const detected = React.useSyncExternalStore(
    subscribeNever,
    detectLang,
    serverLang,
  );
  // Null until the visitor touches the toggle, at which point their choice
  // wins over the browser's.
  const [chosen, setChosen] = React.useState<Lang | null>(null);
  const lang = chosen ?? detected;
  const setLang = setChosen;

  const rtl = lang === "ar";

  // Appended to every node whose text is Arabic. Empty on the English face so
  // the Latin side keeps the brand's Geist and its `.eyebrow` tracking.
  const ar = rtl ? ` ${styles.arabic}` : "";
  // The eyebrow labels, which need a size nudge on top of the face swap.
  const arLabel = rtl ? ` ${styles.arabic} ${styles.arabicLabel}` : "";

  const blocks: Record<CardBlock, React.ReactNode> = {
    card: (
      <div key="card">
        {/*
          The logo is the card's heading — there is no wordmark in type above
          it, so the company name lives in the alt text.

          Sized for the stacked lockup: mark over "BAZAR" over "REAL ESTATE",
          where the third line is a tenth of the height and goes unreadable in
          the 92px slot a horizontal wordmark would need. `object-contain`
          means a wide logo uploaded from the CMS still fits, it just sits
          shorter inside the box.
        */}
        <h1 className="flex flex-col items-center">
          <span className="relative block h-[148px] w-full max-w-[260px]">
            <Image
              src={props.logoUrl}
              alt={props.logoAlt}
              fill
              sizes="260px"
              className="object-contain"
              priority
            />
          </span>
        </h1>

        {pick(props.tagline, lang) ? (
          <p
            className={`mt-3 text-center text-[13.5px] leading-relaxed text-bz-navy${ar}`}
            lang={lang}
          >
            {pick(props.tagline, lang)}
          </p>
        ) : null}

        <a
          href={props.vcardHref}
          download={props.vcardFilename}
          data-testid="qr-save-contact"
          className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-bz-navy px-5 text-[16px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <UserPlus size={19} strokeWidth={1.8} aria-hidden="true" />
          <span
            className={rtl ? `${styles.arabic} ${styles.arabicStrong}` : ""}
            lang={lang}
          >
            {pick(props.saveLabel, lang)}
          </span>
        </a>
      </div>
    ),

    details: (
      <ul key="details" className="divide-y divide-bz-border">
        {props.rows.map((row) => {
          const Icon = ROW_ICON[row.kind];
          const label = pick(row.label, lang);
          const value = pick(row.value, lang);
          const inner = (
            <>
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-bz-navy text-white">
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {label ? (
                  <span
                    className={`eyebrow whitespace-nowrap${arLabel}`}
                    lang={lang}
                  >
                    {label}:
                  </span>
                ) : null}
                {/*
                  Everything but the address is Latin script — a phone number
                  or an email dropped into an RTL paragraph gets reordered by
                  the bidi algorithm (+971 50 691 1103 renders as
                  1103 691 50 971+), so those values carry their own direction.
                */}
                <span
                  className={`text-[15px] font-medium leading-snug break-words${
                    row.kind === "office" ? ar : ""
                  }`}
                  dir={row.kind === "office" ? undefined : "ltr"}
                  lang={row.kind === "office" ? lang : undefined}
                >
                  {value}
                </span>
              </span>
            </>
          );
          return (
            <li key={row.kind}>
              {row.href ? (
                <a
                  href={row.href}
                  data-testid={row.testId}
                  {...(row.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex items-center gap-3.5 py-3.5 transition-opacity hover:opacity-70"
                >
                  {inner}
                </a>
              ) : (
                <div className="flex items-center gap-3.5 py-3.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    ),

    follow: (
      <div key="follow">
        {props.socials.length > 0 ? (
          <>
            {pick(props.followLabel, lang) ? (
              <div className={`eyebrow text-center${arLabel}`} lang={lang}>
                {pick(props.followLabel, lang)}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {props.socials.map((s) => (
                <a
                  key={s.network + s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.network}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-bz-border bg-bz-surface-2 text-bz-navy transition-colors hover:border-bz-navy"
                >
                  <SocialIcon network={s.network} />
                </a>
              ))}
            </div>
          </>
        ) : null}

        {props.mapHref ? (
          <a
            href={props.mapHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="qr-directions-link"
            className="mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-bz-border bg-bz-surface-2 px-5 text-[14.5px] font-medium text-bz-navy transition-colors hover:border-bz-navy"
          >
            <MapPin size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className={ar.trim()} lang={lang}>
              {pick(props.mapLabel, lang)}
            </span>
          </a>
        ) : null}

        {pick(props.footerNote, lang) ? (
          <p
            className={`mt-5 text-center text-[11.5px] text-bz-muted${ar}`}
            lang={lang}
          >
            {pick(props.footerNote, lang)}
          </p>
        ) : null}
      </div>
    ),
  };

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      lang={lang}
      className="mx-auto w-full max-w-[420px] rounded-[26px] border-2 border-bz-navy bg-bz-surface px-5 py-6"
    >
      {/*
        Segmented toggle. Written in DOM order EN, AR — `dir` flips it, so the
        active language always sits on the leading edge of the reading order.
      */}
      <div
        role="group"
        aria-label="Language"
        className="mx-auto flex w-fit items-center gap-1 rounded-full bg-bz-surface-2 p-1"
      >
        {(["en", "ar"] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            data-testid={`qr-lang-${code}`}
            className={
              lang === code
                ? "rounded-full bg-bz-navy px-5 py-1.5 text-[12px] font-semibold tracking-wider text-white"
                : "rounded-full px-5 py-1.5 text-[12px] font-semibold tracking-wider text-bz-muted transition-colors hover:text-bz-ink"
            }
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {props.blocks.map((key) => blocks[key])}
      </div>
    </div>
  );
}
