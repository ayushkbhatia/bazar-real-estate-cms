import Image from "next/image";
import Link from "@/components/i18n/link";
import { contactLines } from "@/lib/queries/footer";
import type { FooterContent } from "@/lib/schemas/footer";

/**
 * The site footer, drawn entirely from `footer_*` (see /admin/footer).
 *
 * It used to hold its own content: three `const` arrays of links, a social
 * list, a contact block and a paragraph of brand copy, all English, all in
 * code. Flipping the site to Arabic reversed the LAYOUT correctly — the
 * logical utilities did their job — and left every word in it English, because
 * the only strings that could translate were the four in
 * `messages/<locale>/footer.json`. Content in a component is content nobody can
 * translate and nobody can edit; 0112/0113 moved it into tables and this file
 * became presentational, which is what it should always have been.
 *
 * Both props are resolved by the layout rather than read here, so this stays a
 * component with no data dependency of its own — the same contract the top
 * bar's logo already used.
 */
export function PublicFooter({
  data,
  logo,
}: {
  data: FooterContent;
  logo?: { url: string; name: string } | null;
}) {
  const { settings, columns, legal, socials, contact } = data;
  return (
    <footer className="bg-bz-ink text-[oklch(0.85_0.005_80)] px-4 md:px-12 pt-14 md:pt-16 pb-8">
      {/*
        The middle tracks are per-column, not a fixed `repeat(3,1fr)`.
        An editor adding a fourth column in /admin/footer used to be a silent
        layout break — the brand block and the contact block are pinned at
        either end, and a fourth column had nowhere to go. Tailwind cannot
        build a class name from a runtime value, so the count travels as a
        custom property and the arbitrary-value class reads it.
      */}
      <div
        className="grid grid-cols-2 gap-10 md:grid-cols-[1.5fr_var(--footer-tracks)_1.15fr] md:gap-12 pb-12"
        style={
          {
            "--footer-tracks": `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`,
          } as React.CSSProperties
        }
      >
        {/* Brand + socials */}
        <div className="col-span-2 md:col-span-1">
          {logo ? (
            /*
             * `h-10 w-auto` on a fill-less image: the file's own aspect ratio
             * decides the width, so a square mark and a wide lockup both land
             * at the same optical height. Explicit width/height are the
             * intrinsic hint next/image needs when the box is not fixed —
             * the CSS above overrides both.
             */
            <Image
              src={logo.url}
              alt={logo.name}
              width={320}
              height={80}
              sizes="240px"
              className="h-10 w-auto object-contain object-start"
              priority={false}
            />
          ) : (
            <div className="serif italic text-[28px] text-white leading-none">
              Bazar
            </div>
          )}
          {settings.blurb ? (
            <p className="mt-3 max-w-[280px] text-[13px] leading-[1.6] text-[oklch(0.7_0.005_80)]">
              {settings.blurb}
            </p>
          ) : null}
          {socials.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  /* A network name is Latin in every locale, so it is isolated
                     rather than left to inherit the RTL run around it. */
                  dir="ltr"
                  /* Measured at 31px tall; 44px below `md`, and `md:min-h-0`
                     hands the height back to the padding that draws it today.
                     The pill is already a flex item of the row above, so its
                     `display` is blockified either way — `inline-flex` only
                     buys the centring `min-h-11` needs.

                     `min-w-11` carries no `md:` twin because it is not a
                     breakpoint concern: the label is CMS copy (0113 seeds
                     Facebook … LinkedIn, all far wider), but a network that
                     renamed itself to one letter would draw a 33px pill at
                     every width. The floor never binds on the seeded set. */
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[oklch(0.3_0_0)] px-3 py-1.5 text-[11.5px] text-[oklch(0.8_0.005_80)] transition-colors hover:border-bz-teal hover:text-white md:min-h-0"
                >
                  {s.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.id}>
            {col.heading ? (
              <h4 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-bz-taupe">
                {col.heading}
              </h4>
            ) : null}
            {/*
              A 13.5px anchor is an 18px-tall target, and every route that
              renders this footer — 23 of them — renders every one of these.
              They are a nav list, not running prose, so the exemption that
              spares inline links (padding them to 44px wrecks a paragraph)
              does not cover them, and neither does the `(pointer: coarse)`
              rule in globals.css: that one is keyed off `[data-slot]`, which
              a plain anchor never carries.

              Below `md` each anchor becomes a 44px block that fills the column
              width, and the list's own 10px gap goes to 0: two stacked 44px
              rows already read as separate rows, and keeping the gap on top
              would have added ~50px per column to a footer that is the last
              thing anyone wants to scroll past. From `md` the anchor is inline
              again and the 10px gap draws the density it always has.
            */}
            <ul className="flex flex-col gap-0 md:gap-2.5 text-[13.5px]">
              {col.links.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center transition-colors hover:text-white md:inline md:min-h-0"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact */}
        <div className="col-span-2 md:col-span-1">
          {settings.contact_heading ? (
            <h4 className="mb-4 text-[12px] font-medium uppercase tracking-wider text-bz-taupe">
              {settings.contact_heading}
            </h4>
          ) : null}
          <ul className="flex flex-col gap-4 text-[13.5px]">
            {contact.map((item) => (
              <li key={item.id}>
                <div className="text-[11.5px] text-[oklch(0.6_0.005_80)]">
                  {item.label}
                </div>
                {contactLines(item).map((line, i) =>
                  line.href ? (
                    <a
                      key={i}
                      href={line.href}
                      /* A phone number's leading `+` is a bidi neutral and
                         jumps to the wrong end of an Arabic line without this.
                         See docs/I18N.md, "text that mixes Arabic and Latin". */
                      dir={
                        item.kind === "phone" || item.kind === "email"
                          ? "ltr"
                          : undefined
                      }
                      /* Same 44px floor as the link columns. These carry more
                         weight than any of them on a phone — a `tel:` here is
                         one tap from a call — and they were the same 18px.
                         `w-fit` stays so the underline still tracks the number
                         rather than the column. */
                      className="flex min-h-11 w-fit items-center text-white hover:underline md:block md:min-h-0"
                    >
                      {line.value}
                    </a>
                  ) : (
                    <div key={i} className="leading-[1.55]">
                      {line.value}
                    </div>
                  ),
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-4 border-t border-[oklch(0.28_0_0)] pt-6 text-[12px] text-[oklch(0.6_0.005_80)]">
        <div>{settings.legal_line}</div>
        {/* The legal row is the same nav-list case as the columns above, one
            size smaller: 12px text, so ~15px tall. The 24px gap already gives
            them separation; only the height was missing. */}
        <div className="flex gap-6">
          {legal.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className="flex min-h-11 items-center hover:text-white md:inline md:min-h-0"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
