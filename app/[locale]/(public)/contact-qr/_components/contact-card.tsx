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
import { LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { CardLocaleToggle } from "./card-locale-toggle";
import { SocialIcon } from "./social-icons";
import styles from "./contact-card.module.css";

/**
 * The /contact-qr card.
 *
 * A digital business card: one screen, one primary action ("Add to Contacts",
 * which downloads a vCard), and a row per way of reaching us.
 *
 * A Server Component, and that is the whole shape of it. The card used to be
 * `"use client"` for one reason — it held the EN/AR choice in `useState` and
 * carried every label in both languages so it could swap them without a
 * fetch. Once `getMasterPageContent` began folding the `_ar` twins down to the
 * request's locale, the server was already handing it one language and the
 * second copy was the same string twice. So the language now comes from the
 * route, the labels are plain strings, and the only thing left that needs the
 * browser is the toggle's own href — which is `CardLocaleToggle`, a few lines
 * of client code instead of the whole card.
 */

export type RowKind =
  | "mobile"
  | "landline"
  | "whatsapp"
  | "email"
  | "website"
  | "office";

export type ContactRow = {
  kind: RowKind;
  label: string;
  value: string;
  href: string | null;
  /** Opens outside the page — WhatsApp, the website. */
  external?: boolean;
  testId?: string;
};

/** Which of the card's three stacks render, and in what order. */
export type CardBlock = "card" | "details" | "follow";

export type ContactCardProps = {
  /** The route's locale — what the card is rendered in, and what the toggle marks active. */
  locale: Locale;
  blocks: CardBlock[];
  /** Not drawn on the card — it is the logo's alt text and the saved contact's name. */
  name: string;
  /** Always set: the CMS image when one is uploaded, the bundled logo otherwise. */
  logoUrl: string;
  logoAlt: string;
  tagline: string;
  saveLabel: string;
  /** The .vcf route. */
  vcardHref: string;
  vcardFilename: string;
  rows: ContactRow[];
  followLabel: string;
  socials: { network: string; href: string }[];
  mapLabel: string;
  mapHref: string | null;
  footerNote: string;
};

const ROW_ICON: Record<RowKind, LucideIcon> = {
  mobile: Smartphone,
  landline: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  website: Globe,
  office: MapPin,
};

export function ContactCard(props: ContactCardProps) {
  const { locale } = props;
  const rtl = LOCALE_DIR[locale] === "rtl";

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

        {props.tagline ? (
          <p
            className={`mt-3 text-center text-[13.5px] leading-relaxed text-bz-navy${ar}`}
          >
            {props.tagline}
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
          >
            {props.saveLabel}
          </span>
        </a>
      </div>
    ),

    details: (
      <ul key="details" className="divide-y divide-bz-border">
        {props.rows.map((row) => {
          const Icon = ROW_ICON[row.kind];
          const inner = (
            <>
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-bz-navy text-white">
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {row.label ? (
                  <span className={`eyebrow whitespace-nowrap${arLabel}`}>
                    {row.label}:
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
                >
                  {row.value}
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
            {props.followLabel ? (
              <div className={`eyebrow text-center${arLabel}`}>
                {props.followLabel}
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
            <span className={ar.trim()}>{props.mapLabel}</span>
          </a>
        ) : null}

        {props.footerNote ? (
          <p className={`mt-5 text-center text-[11.5px] text-bz-muted${ar}`}>
            {props.footerNote}
          </p>
        ) : null}
      </div>
    ),
  };

  return (
    /*
      `dir` and `lang` are already on `<html>` for this locale. They are
      repeated here because the card is a self-contained artifact — it is the
      one thing on the page a visitor screenshots and sends on — and because a
      reader looking at this file should not have to walk up to the root layout
      to learn which way it lays out.
    */
    <div
      dir={LOCALE_DIR[locale]}
      lang={locale}
      className="mx-auto w-full max-w-[420px] rounded-[26px] border-2 border-bz-navy bg-bz-surface px-5 py-6"
    >
      <CardLocaleToggle current={locale} />

      <div className="mt-6 flex flex-col gap-6">
        {props.blocks.map((key) => blocks[key])}
      </div>
    </div>
  );
}
