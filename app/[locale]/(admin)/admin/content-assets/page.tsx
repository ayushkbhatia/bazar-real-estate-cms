import Link from "next/link";
import {
  Plus,
  Trash2,
  Mail,
  MessageCircle,
  ArrowRight,
  Zap,
  Palette,
  Ban,
} from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
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
  listContentAssets,
  listFormAssignments,
  type ContentAssetRow,
} from "@/lib/queries/content-assets";
import { CONTENT_ASSET_KIND_LABELS } from "@/lib/schemas/content-asset";
import {
  EMAILS_NOT_SENT,
  PREVIEW_ONLY_EMAILS,
  SYSTEM_ASSETS,
  SYSTEM_ASSET_KEYS,
  type EmailAudience,
  type SystemAssetKey,
} from "@/lib/content-assets/system";
import { readEmailBrand, usableCopy } from "@/lib/content-assets/system-resolve";
import {
  previewAdvisorReply,
  renderGallery,
} from "@/lib/content-assets/system-emails";
import type { SystemEmailCopy } from "@/lib/content-assets/system-render";
import { SYSTEM_EMAIL_DEFAULTS } from "@/lib/content-assets/system-defaults";
import { sanitizeEmailBody } from "@/lib/content-assets/email-html";
import { emailSurfaces, type EmailSurface } from "@/lib/content-assets/usage";
import { LangToggle, langFrom, withLang } from "./_lang-toggle";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import { AssetRowActions } from "./_row-actions";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: ContentAssetRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
        status === "published"
          ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
          : "bg-bz-surface-2 text-bz-ink-2",
      )}
    >
      {status === "published" ? "Published" : "Draft"}
    </span>
  );
}

function KindPill({ kind }: { kind: ContentAssetRow["kind"] }) {
  const Icon = kind === "email" ? Mail : MessageCircle;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2">
      <Icon size={13} strokeWidth={1.7} className="text-bz-muted" />
      {CONTENT_ASSET_KIND_LABELS[kind]}
    </span>
  );
}

/** First line of the body, for an at-a-glance sense of the copy. */
function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim() !== "") ?? "";
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
}

type View = "emails" | "outreach" | "trash";

const TABS: { view: View | "design" | "replies"; label: string; href: string }[] = [
  { view: "emails", label: "Site emails", href: "/admin/content-assets" },
  {
    view: "replies",
    label: "Form replies",
    href: "/admin/content-assets/replies",
  },
  { view: "outreach", label: "Outreach", href: "/admin/content-assets?view=outreach" },
  { view: "design", label: "Email design", href: "/admin/content-assets/design" },
  { view: "trash", label: "Trash", href: "/admin/content-assets?view=trash" },
];

/** "Contact · /contact, Buy · /buy and 16 more" — the card's one line. */
function surfaceSummary(surfaces: EmailSurface[]): string {
  if (surfaces.length === 0) return "Nothing sends this yet";
  const named = surfaces.slice(0, 2).map((s) => s.path ?? s.label);
  const rest = surfaces.length - named.length;
  return rest > 0 ? `${named.join(", ")} and ${rest} more` : named.join(", ");
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A scaled-down, non-interactive render of the email. The frame is laid out
 * at a real inbox width and shrunk, so the thumbnail is the email itself
 * rather than a drawing of it.
 */
function Thumbnail({ html, title }: { html: string; title: string }) {
  return (
    <div className="relative h-[230px] overflow-hidden bg-[#FAFAF6] border-b border-bz-border">
      <div className="absolute inset-x-0 top-0 flex justify-center">
        <div className="w-[300px] h-[230px] overflow-hidden">
          <iframe
            title={title}
            srcDoc={html}
            sandbox=""
            loading="lazy"
            tabIndex={-1}
            aria-hidden
            className="block border-0 origin-top-left pointer-events-none"
            style={{ width: 600, height: 460, transform: "scale(0.5)" }}
          />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#FAFAF6] to-transparent" />
    </div>
  );
}

function EmailCard({
  href,
  label,
  trigger,
  subject,
  html,
  status,
  usedOn,
}: {
  href: string;
  label: string;
  trigger: string;
  subject: string;
  html: string;
  usedOn: string;
  status: { tone: "live" | "draft" | "builtin" | "preview"; text: string };
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-border-strong hover:shadow-sm transition"
    >
      <Thumbnail html={html} title={`${label} preview`} />
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="font-medium text-[14px] leading-snug group-hover:text-bz-accent transition-colors">
            {label}
          </h3>
          <span
            className={cn(
              "ms-auto shrink-0 inline-flex items-center h-[20px] px-1.5 rounded-full text-[10.5px] font-medium whitespace-nowrap",
              status.tone === "live" && "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
              status.tone === "draft" && "bg-[oklch(0.95_0.04_80)] text-[oklch(0.42_0.08_70)]",
              status.tone === "builtin" && "bg-bz-surface-2 text-bz-ink-2",
              status.tone === "preview" && "bg-bz-surface-2 text-bz-muted",
            )}
          >
            {status.text}
          </span>
        </div>
        <p className="text-[12px] text-bz-ink-2 truncate" title={subject}>
          <span className="text-bz-muted">Subject · </span>
          {subject}
        </p>
        <p className="text-[12px] text-bz-muted leading-snug line-clamp-2">{trigger}</p>
        <p className="mt-auto pt-2 text-[11.5px] text-bz-ink-2 truncate" title={usedOn}>
          <span className="text-bz-muted">Sent from · </span>
          {usedOn}
        </p>
      </div>
    </Link>
  );
}

async function EmailsView({ lang }: { lang: EmailLocale }) {
  const [rows, brand, assignments] = await Promise.all([
    listContentAssets({ scope: "system" }),
    readEmailBrand(),
    listFormAssignments(),
  ]);
  // Which forms have been pointed at a reply of their own — those no longer
  // send the acknowledgement, and the card should not claim they do.
  const assigned = Object.fromEntries(
    Object.entries(assignments).map(([key, a]) => [key, a.assetId]),
  );
  const byKey = new Map(
    rows
      .filter((r): r is ContentAssetRow & { system_key: SystemAssetKey } => r.system_key !== null)
      .map((r) => [r.system_key, r]),
  );
  const published: Partial<Record<SystemAssetKey, SystemEmailCopy>> = {};
  for (const [key, row] of byKey) {
    if (row.status !== "published") continue;
    const copy = usableCopy(key, row);
    if (copy) published[key] = copy;
  }
  const gallery = renderGallery(published, brand, lang);
  const advisorReply = previewAdvisorReply(brand);

  const liveOwn = SYSTEM_ASSET_KEYS.filter(
    (k) => gallery[k].liveSource.kind === "override" && byKey.get(k)?.status === "published",
  ).length;
  const total = SYSTEM_ASSET_KEYS.length + PREVIEW_ONLY_EMAILS.length;

  function statusFor(key: SystemAssetKey): Parameters<typeof EmailCard>[0]["status"] {
    const row = byKey.get(key);
    if (lang === "ar") {
      // On the Arabic side the question is not "is this published?" but "is
      // there any Arabic at all?" — a published email with no Arabic answers
      // an Arabic lead in English, and the card has to say so.
      const written = Boolean(row?.subject_ar?.trim() && row?.body_ar?.trim());
      if (!written) return { tone: "builtin", text: "English is sent" };
      return row?.status === "published"
        ? { tone: "live", text: "Arabic is sent" }
        : { tone: "draft", text: "Arabic ready, not published" };
    }
    if (row?.status === "published") return { tone: "live", text: "Your wording" };
    const source = gallery[key].liveSource;
    if (source.kind === "override")
      return { tone: "builtin", text: `Uses ${SYSTEM_ASSETS[source.key].label.split(" ")[0]}` };
    // A draft that is no longer Bazar's starting wording is work in progress.
    // Compared through the sanitiser, which is what a save writes: saving the
    // starting wording untouched is not an edit.
    if (
      row &&
      (sanitizeEmailBody(row.body) !== sanitizeEmailBody(SYSTEM_EMAIL_DEFAULTS[key].body) ||
        row.subject !== SYSTEM_EMAIL_DEFAULTS[key].subject)
    )
      return { tone: "draft", text: "Draft in progress" };
    return { tone: "builtin", text: "Built-in" };
  }

  const groups: { audience: EmailAudience; title: string; blurb: string }[] = [
    {
      audience: "client",
      title: "To leads and clients",
      blurb: "Acknowledgements, confirmations and follow-ups — the emails a lead reads.",
    },
    {
      audience: "team",
      title: "To your team",
      blurb: "Invitations, sign-in links and the notices the site sends staff.",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { n: total, label: "emails the site sends" },
          {
            n: SYSTEM_ASSET_KEYS.filter((k) => SYSTEM_ASSETS[k].audience === "client").length +
              PREVIEW_ONLY_EMAILS.filter((e) => e.audience === "client").length,
            label: "to leads and clients",
          },
          {
            n: SYSTEM_ASSET_KEYS.filter((k) => SYSTEM_ASSETS[k].audience === "team").length,
            label: "to your team",
          },
          { n: liveOwn, label: liveOwn === 1 ? "sends your wording" : "send your wording" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-bz-border bg-bz-surface px-4 py-3">
            <div className="serif text-[28px] leading-none">{s.n}</div>
            <div className="mt-1.5 text-[12px] text-bz-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bz-border bg-bz-surface px-4 py-3 text-[12.5px] text-bz-ink-2">
        <Palette size={14} strokeWidth={1.8} className="text-bz-muted" />
        <span className="flex-1 min-w-[220px]">
          Logo, colours and footer are shared by every email below, built-in or rewritten.
        </span>
        <Link
          href="/admin/content-assets/design"
          className="inline-flex items-center gap-1 text-bz-ink underline-offset-2 hover:underline"
        >
          Email design <ArrowRight size={12} strokeWidth={1.8} />
        </Link>
      </div>

      {groups.map((g) => (
        <section key={g.audience} className="flex flex-col gap-3">
          <div>
            <h2 className="serif text-[22px] leading-tight">{g.title}</h2>
            <p className="text-[12.5px] text-bz-muted mt-0.5">{g.blurb}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {SYSTEM_ASSET_KEYS.filter((k) => SYSTEM_ASSETS[k].audience === g.audience).map(
              (key) => (
                <EmailCard
                  key={key}
                  href={withLang(`/admin/content-assets/emails/${key}`, lang)}
                  label={SYSTEM_ASSETS[key].label}
                  trigger={SYSTEM_ASSETS[key].trigger}
                  subject={gallery[key].live.subject}
                  html={gallery[key].live.html}
                  status={statusFor(key)}
                  usedOn={surfaceSummary(emailSurfaces(key, assigned))}
                />
              ),
            )}
            {PREVIEW_ONLY_EMAILS.filter((e) => e.audience === g.audience).map((e) => (
              <EmailCard
                key={e.key}
                href={withLang(`/admin/content-assets/emails/${e.key}`, lang)}
                label={e.label}
                trigger={e.trigger}
                subject={advisorReply.subject}
                html={advisorReply.html}
                status={{ tone: "preview", text: "Preview only" }}
                usedOn={surfaceSummary(emailSurfaces(e.key, assigned))}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-lg border border-dashed border-bz-border bg-bz-surface px-5 py-4">
        <div className="flex items-center gap-2">
          <Ban size={13} strokeWidth={1.8} className="text-bz-muted" />
          <h2 className="text-[13px] font-medium">Not sent by this site</h2>
        </div>
        <ul className="mt-2 flex flex-col gap-2 text-[12.5px]">
          {EMAILS_NOT_SENT.map((e) => (
            <li key={e.label}>
              <span className="text-bz-ink-2">{e.label}.</span>{" "}
              <span className="text-bz-muted">{e.why}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function LibraryView({ view }: { view: "outreach" | "trash" }) {
  const rows =
    view === "trash"
      ? await listContentAssets({ trashed: true })
      : await listContentAssets({ scope: "outreach" });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-bz-muted">
        {rows.length} {rows.length === 1 ? "asset" : "assets"}
        {view === "trash" ? " in trash" : ""}
      </div>
      <div className="bg-bz-surface border border-bz-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[42%]">Asset</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follows with</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-bz-muted">
                  {view === "trash" ? (
                    "Trash is empty. Assets you delete land here first."
                  ) : (
                    <>
                      No assets yet — write the first one with{" "}
                      <Link href="/admin/content-assets/new" className="text-bz-ink underline">
                        New asset
                      </Link>
                      .
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const next = row.next_asset_id ? byId.get(row.next_asset_id) : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/content-assets/${row.id}`}
                        className="block hover:text-bz-accent transition-colors"
                      >
                        <div className="font-medium truncate max-w-[60ch]">{row.name}</div>
                        <div className="text-[11.5px] text-bz-muted mt-0.5 truncate max-w-[60ch]">
                          {firstLine(row.body)}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <KindPill kind={row.kind} />
                    </TableCell>
                    <TableCell className="text-bz-ink-2 text-[12.5px] capitalize">
                      {row.category}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.status} />
                    </TableCell>
                    <TableCell className="text-[12px] text-bz-muted">
                      {next ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowRight size={11} strokeWidth={1.8} />
                          {next.name}
                          {row.follow_up_after_days ? ` · ${row.follow_up_after_days}d` : ""}
                        </span>
                      ) : row.follow_up_after_days ? (
                        `after ${row.follow_up_after_days}d`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <AssetRowActions id={row.id} name={row.name} trashed={view === "trash"} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default async function ContentAssetsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.view) ? sp.view[0] : sp.view) ?? "";
  // `?view=system` is the old address of the emails tab; it still lands there.
  const view: View = raw === "trash" ? "trash" : raw === "outreach" ? "outreach" : "emails";
  const lang = langFrom(sp.lang);

  const trashCount = (await listContentAssets({ trashed: true })).length;

  return (
    <CmsShell
      title="Content assets"
      breadcrumbs="Content · Assets"
      primary={
        view === "outreach" ? (
          <Button asChild>
            <Link href="/admin/content-assets/new">
              <Plus size={14} strokeWidth={1.8} />
              New asset
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-[13px] text-bz-muted max-w-[75ch]">
          {view === "emails" ? (
            <>
              Every email this site sends, drawn exactly as it arrives — addressed
              to a sample recipient. Open one to rewrite it: your version replaces
              Bazar&apos;s built-in wording only once you publish it, and going back
              to draft puts the built-in wording back.{" "}
              {lang === "ar" ? (
                <>
                  You are looking at the <strong>Arabic</strong> half, which is
                  what a lead who filled in an Arabic form receives. An email
                  with no Arabic written sends its English to them.
                </>
              ) : (
                <>
                  Leads who use the Arabic site are answered from the Arabic
                  half — switch with the toggle.
                </>
              )}
            </>
          ) : view === "outreach" ? (
            <>
              The outreach library. Email and WhatsApp copy an advisor sends by
              hand, written once and reused from the enquiry composer. The emails
              the site sends by itself are under{" "}
              <Link href="/admin/content-assets" className="text-bz-ink underline">
                Site emails
              </Link>
              .
            </>
          ) : (
            <>Outreach assets you deleted. Restore one to bring it back as a draft.</>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
        <nav
          aria-label="Content assets sections"
          className="inline-flex w-fit flex-wrap rounded-md border border-bz-border bg-bz-bg p-0.5"
        >
          {TABS.map((tab) => {
            const active = view === tab.view;
            const Icon =
              tab.view === "emails"
                ? Zap
                : tab.view === "outreach"
                  ? MessageCircle
                  : tab.view === "design"
                    ? Palette
                    : Trash2;
            return (
              <Link
                key={tab.view}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
                  active ? "bg-bz-navy text-bz-bg font-medium" : "text-bz-ink-2 hover:text-bz-ink",
                )}
              >
                <Icon size={12} strokeWidth={1.8} />
                {tab.label}
                {tab.view === "emails" ? (
                  <span className={cn("mono text-[10.5px]", active ? "text-bz-bg/80" : "text-bz-muted")}>
                    {SYSTEM_ASSET_KEYS.length + PREVIEW_ONLY_EMAILS.length}
                  </span>
                ) : tab.view === "trash" ? (
                  <span className={cn("mono text-[10.5px]", active ? "text-bz-bg/80" : "text-bz-muted")}>
                    {trashCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {view === "emails" ? (
          <LangToggle lang={lang} hrefFor={(l) => withLang("/admin/content-assets", l)} />
        ) : null}
        </div>

        {view === "emails" ? <EmailsView lang={lang} /> : <LibraryView view={view} />}
      </div>
    </CmsShell>
  );
}
