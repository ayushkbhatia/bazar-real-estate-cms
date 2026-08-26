"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UPLOAD_POLICIES, fontFormatFor, megabytes } from "@/lib/media";
import {
  ARABIC_FONT_ROLES,
  ARABIC_FONT_WEIGHTS,
  ARABIC_ROLE_DESCRIPTION,
  ARABIC_ROLE_LABEL,
  ARABIC_WEIGHT_LABEL,
  arabicFontCss,
  arabicFontSettingsSchema,
  familySlug,
  guessStyle,
  guessWeight,
  type ArabicFontFamily,
  type ArabicFontFile,
  type ArabicFontRole,
  type ArabicFontSettings,
  type ArabicFontWeight,
} from "@/lib/schemas/arabic-fonts";
import { uploadToLibrary } from "../../media/_upload-client";
import { updateArabicFontSettings } from "./_actions";

/**
 * /admin/settings/typography — the Arabic face, chosen by the client.
 *
 * The screen is deliberately shaped around what the client actually has: a zip
 * from a foundry containing four or five weights of one family. So the primary
 * gesture is "drop these files in", the weight of each is guessed from its
 * filename, and the only decision left is which of the four typographic roles
 * the family fills.
 *
 * The specimen at the bottom renders through the SAME serialiser the public
 * site uses — `arabicFontCss` — rather than a preview approximation of it. A
 * preview that agrees with production because it is production is the only
 * kind worth showing for typography, where the whole question is "does this
 * look right".
 */

// The specimen copy. Real marketplace phrasing rather than lorem, so the
// client is judging the face on the words it will actually set.
const SPECIMEN = {
  eyebrow: "عقارات مختارة",
  display: "أبوظبي، كما يجب أن تُفهم",
  body: "استشارات عقارية مصمَّمة خصيصًا وسوق منسّق للمشترين والبائعين والمستثمرين في دولة الإمارات العربية المتحدة.",
  mono: "AED 4,250,000 · 2,340 ft² · BR-1042",
};

type LocalFile = ArabicFontFile & { uid: string };
type LocalFamily = Omit<ArabicFontFamily, "files"> & { files: LocalFile[] };

let seq = 0;
const uid = () => `u${(seq += 1)}`;

/** A browser-side id for a family, stable for the life of the row. */
function newFamilyId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fam-${Date.now()}-${seq += 1}`;
}

/**
 * "IBMPlexSansArabic-SemiBold.woff2" → "IBMPlexSansArabic".
 *
 * Only used to pre-fill the name of a family created by dropping files, so it
 * is allowed to be approximate — the operator retypes it if it guessed badly.
 */
function familyNameFromFile(filename: string): string {
  const stem = filename.replace(/\.[a-z0-9]+$/i, "");
  const cut = stem.split(/[-_](?=[^-_]*$)/)[0] ?? stem;
  const spaced = cut
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  return (spaced || stem).slice(0, 60);
}

export function ArabicTypographyForm({
  initial,
}: {
  initial: ArabicFontSettings;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [families, setFamilies] = useState<LocalFamily[]>(() =>
    initial.families.map((f) => ({
      ...f,
      files: f.files.map((file) => ({ ...file, uid: uid() })),
    })),
  );
  const [roles, setRoles] = useState(initial.roles);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enabledId = useId();

  const payload: ArabicFontSettings = useMemo(
    () => ({
      enabled,
      families: families.map(({ files, ...rest }) => ({
        ...rest,
        files: files.map(({ uid: _uid, ...file }) => file),
      })),
      roles,
    }),
    [enabled, families, roles],
  );

  /*
   * The specimen's stylesheet, produced by the public serialiser with
   * `enabled` forced on — so a client can see what they are about to turn on
   * before turning it on, and can keep looking at it while it is off.
   */
  const preview = useMemo(
    () => arabicFontCss({ ...payload, enabled: true }),
    [payload],
  );

  function patchFamily(id: string, patch: Partial<LocalFamily>) {
    setFamilies((cur) =>
      cur.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  function removeFamily(id: string) {
    setFamilies((cur) => cur.filter((f) => f.id !== id));
    // A role pointing at a family that no longer exists fails the schema, so
    // the assignment is released here rather than surfacing as a save error
    // about a family the operator can no longer see.
    setRoles((cur) => {
      const next = { ...cur };
      for (const role of ARABIC_FONT_ROLES)
        if (next[role] === id) next[role] = null;
      return next;
    });
  }

  /** Upload files into a family, creating it when `familyId` is null. */
  async function ingest(fileList: FileList | null, familyId: string | null) {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return;

    const token = familyId ?? "new";
    setBusy(token);
    const uploaded: LocalFile[] = [];
    for (const file of picked) {
      const result = await uploadToLibrary(file, {
        folder: "fonts",
        kind: "font",
      });
      if (result.status === "error") {
        toast.error(result.message);
        continue;
      }
      uploaded.push({
        uid: uid(),
        url: result.url,
        filename: file.name,
        // `fontFormatFor` can only return null for an extension the upload
        // policy already refused, so this fallback is unreachable in practice
        // — it exists so the type is honest rather than asserted.
        format: fontFormatFor(file.name) ?? "woff2",
        weight: guessWeight(file.name),
        style: guessStyle(file.name),
      });
    }
    setBusy(null);
    if (uploaded.length === 0) return;

    if (familyId) {
      setFamilies((cur) =>
        cur.map((f) =>
          f.id === familyId ? { ...f, files: [...f.files, ...uploaded] } : f,
        ),
      );
    } else {
      const name = familyNameFromFile(uploaded[0].filename);
      setFamilies((cur) => [
        ...cur,
        {
          id: newFamilyId(),
          name,
          slug: familySlug(name, cur.map((f) => f.slug)),
          files: uploaded,
        },
      ]);
    }
    toast.success(
      uploaded.length === 1
        ? `Added ${uploaded[0].filename}.`
        : `Added ${uploaded.length} files.`,
    );
  }

  function save() {
    const parsed = arabicFontSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please fix the errors.");
      return;
    }
    startTransition(async () => {
      const result = await updateArabicFontSettings(parsed.data);
      if (result.status === "ok") toast.success(result.message ?? "Saved.");
      else toast.error(result.message);
    });
  }

  const assignedCount = ARABIC_FONT_ROLES.filter((r) => roles[r]).length;

  return (
    <div className="flex flex-col gap-6">
      {/* ── What this screen does ─────────────────────────────── */}
      <section className="bg-bz-surface border border-bz-border rounded-lg p-6">
        <div className="mb-4 pb-4 border-b border-bz-border">
          <h2 className="text-[15px] font-medium tracking-tight">
            Arabic typography
          </h2>
          <p className="text-[12.5px] text-bz-muted mt-1 leading-[1.55] max-w-[75ch]">
            The faces the Arabic site is set in. Upload your licensed Arabic
            fonts, say which part of the page each one sets, and every Arabic
            page changes together — headings, body, labels and all. The English
            site is untouched.
          </p>
        </div>

        <label
          htmlFor={enabledId}
          className="flex items-start gap-3 cursor-pointer"
        >
          <input
            id={enabledId}
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 size-4 accent-bz-navy"
          />
          <span>
            <span className="text-[13px] font-medium block">
              Use these fonts on the live Arabic site
            </span>
            <span className="text-[11.5px] text-bz-muted-2 block mt-0.5 leading-[1.5]">
              Turn this off to go back to the built-in Arabic face without
              losing your uploads or your assignments.
            </span>
          </span>
        </label>

        {enabled && assignedCount === 0 ? (
          <p className="mt-3 text-[11.5px] text-bz-ink-2 bg-bz-surface-2 border border-bz-border rounded px-3 py-2 leading-[1.55]">
            No role has a font assigned yet, so the site still renders its
            built-in face. Assign one below.
          </p>
        ) : null}
      </section>

      {/* ── Families ──────────────────────────────────────────── */}
      <section className="bg-bz-surface border border-bz-border rounded-lg p-6">
        <div className="mb-4 pb-4 border-b border-bz-border">
          <h2 className="text-[15px] font-medium tracking-tight">
            Font families
          </h2>
          <p className="text-[12.5px] text-bz-muted mt-1 leading-[1.55] max-w-[75ch]">
            One family per typeface, with a file for each weight you own.{" "}
            {UPLOAD_POLICIES.font.accepts} files, up to{" "}
            {megabytes(UPLOAD_POLICIES.font.maxBytes)} MB each. WOFF2 is
            strongly preferred — it is roughly half the size of the same face as
            OTF, and every browser the site supports reads it.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {families.map((family) => (
            <FamilyCard
              key={family.id}
              family={family}
              busy={busy === family.id}
              usedBy={ARABIC_FONT_ROLES.filter((r) => roles[r] === family.id)}
              onRename={(name) => patchFamily(family.id, { name })}
              onPatchFile={(fileUid, patch) =>
                patchFamily(family.id, {
                  files: family.files.map((f) =>
                    f.uid === fileUid ? { ...f, ...patch } : f,
                  ),
                })
              }
              onRemoveFile={(fileUid) =>
                patchFamily(family.id, {
                  files: family.files.filter((f) => f.uid !== fileUid),
                })
              }
              onAddFiles={(list) => ingest(list, family.id)}
              onRemove={() => removeFamily(family.id)}
            />
          ))}

          {families.length === 0 ? (
            <p className="text-[12.5px] text-bz-muted-2 leading-[1.55]">
              No fonts uploaded. The Arabic site is set in IBM Plex Sans Arabic,
              the face this site shipped with.
            </p>
          ) : null}

          <AddFamilyButton busy={busy === "new"} onFiles={(l) => ingest(l, null)} />
        </div>
      </section>

      {/* ── Roles ─────────────────────────────────────────────── */}
      <section className="bg-bz-surface border border-bz-border rounded-lg p-6">
        <div className="mb-4 pb-4 border-b border-bz-border">
          <h2 className="text-[15px] font-medium tracking-tight">
            What each font sets
          </h2>
          <p className="text-[12.5px] text-bz-muted mt-1 leading-[1.55] max-w-[75ch]">
            Four roles, because those are the four the stylesheet can actually
            tell apart. Every h1 and h2 on the site is drawn the same way, so
            they share the display role rather than pretending to be separate
            controls.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {ARABIC_FONT_ROLES.map((role) => (
            <div key={role} className="flex flex-col gap-1.5">
              <Label className="text-[12px] text-bz-ink-2 font-normal">
                {ARABIC_ROLE_LABEL[role]}
              </Label>
              <Select
                value={roles[role] ?? "__none__"}
                onValueChange={(v) =>
                  setRoles((cur) => ({
                    ...cur,
                    [role]: v === "__none__" ? null : v,
                  }))
                }
              >
                <SelectTrigger className="w-full max-w-[420px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {role === "eyebrow"
                      ? "Follow the body face"
                      : role === "mono"
                        ? "Keep numbers Latin (recommended)"
                        : "Built-in Arabic face"}
                  </SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name || f.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11.5px] text-bz-muted-2 leading-[1.5] max-w-[75ch]">
                {ARABIC_ROLE_DESCRIPTION[role]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Specimen ──────────────────────────────────────────── */}
      <Specimen css={preview.css} roles={roles} families={families} />

      <div className="flex items-center gap-2 pb-2">
        <Button onClick={save} disabled={pending || busy !== null}>
          {pending ? "Saving…" : "Save typography"}
        </Button>
        <span className="text-[11.5px] text-bz-muted-2">
          Publishes to every Arabic page.
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Family card
// ───────────────────────────────────────────────────────────────

function FamilyCard({
  family,
  busy,
  usedBy,
  onRename,
  onPatchFile,
  onRemoveFile,
  onAddFiles,
  onRemove,
}: {
  family: LocalFamily;
  busy: boolean;
  usedBy: ArabicFontRole[];
  onRename: (name: string) => void;
  onPatchFile: (uid: string, patch: Partial<LocalFile>) => void;
  onRemoveFile: (uid: string) => void;
  onAddFiles: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const heavy = family.files.filter((f) => f.format !== "woff2").length;

  return (
    <div className="border border-bz-border rounded-md p-4 bg-bz-bg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <Label className="text-[12px] text-bz-ink-2 font-normal">
            Family name
          </Label>
          <Input
            value={family.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder="e.g. 29LT Bukra"
            className="max-w-[320px]"
          />
          <p className="text-[11px] text-bz-muted-2">
            Your label for it. The stylesheet registers it as{" "}
            <span className="mono">{family.slug}</span>, which does not change
            when you rename.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-bz-muted hover:text-bz-danger shrink-0"
          aria-label={`Remove the ${family.name || family.slug} family and all its files`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {usedBy.length > 0 ? (
        <p className="mt-2 text-[11px] text-bz-muted-2">
          Sets {usedBy.map((r) => ARABIC_ROLE_LABEL[r].toLowerCase()).join(", ")}
          .
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {family.files.map((file) => (
          <div
            key={file.uid}
            className="flex flex-wrap items-center gap-2 border border-bz-border rounded px-2.5 py-2 bg-bz-surface"
          >
            <span
              className="mono text-[11.5px] text-bz-ink-2 flex-1 min-w-[180px] truncate"
              title={file.filename}
            >
              {file.filename}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-bz-muted-2">
              {file.format}
            </span>
            <Select
              value={file.weight}
              onValueChange={(v) =>
                onPatchFile(file.uid, { weight: v as ArabicFontWeight })
              }
            >
              <SelectTrigger className="w-[168px] h-8 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARABIC_FONT_WEIGHTS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {ARABIC_WEIGHT_LABEL[w]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={file.style}
              onValueChange={(v) =>
                onPatchFile(file.uid, { style: v as "normal" | "italic" })
              }
            >
              <SelectTrigger className="w-[104px] h-8 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Upright</SelectItem>
                <SelectItem value="italic">Italic</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFile(file.uid)}
              className="text-bz-muted hover:text-bz-danger h-8 px-2"
              aria-label={`Remove the file ${file.filename}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {heavy > 0 ? (
        <p className="mt-2 text-[11px] text-bz-ink-2 leading-[1.5]">
          {heavy === 1 ? "One file is" : `${heavy} files are`} not WOFF2. They
          will work, but each is roughly twice the size a visitor has to
          download before the text appears.
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_POLICIES.font.acceptAttr}
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {busy ? "Uploading…" : "Add weights"}
      </Button>
    </div>
  );
}

function AddFamilyButton({
  busy,
  onFiles,
}: {
  busy: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_POLICIES.font.acceptAttr}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {busy ? "Uploading…" : "Add a font family"}
      </Button>
      <p className="mt-1.5 text-[11px] text-bz-muted-2 leading-[1.5]">
        Select every weight of one family at once — the weight of each file is
        read from its name and can be corrected after.
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Specimen
// ───────────────────────────────────────────────────────────────

/**
 * What the page will look like.
 *
 * The `<style>` here is the public serialiser's output verbatim, and the
 * specimen sits inside `lang="ar" dir="rtl"`, so the `:lang(ar)` rules in
 * globals.css apply to it exactly as they do on /ar — the line height, the
 * suppressed letter-spacing, the eyebrow that stops being uppercase. That is
 * the point: this is not a mock of the Arabic page, it is a piece of one.
 *
 * The role variables are set inline on the wrapper rather than being read from
 * `html:root`, because the emitted rule targets the document root and this
 * screen must not restyle the CMS around it.
 */
function Specimen({
  css,
  roles,
  families,
}: {
  css: string;
  roles: ArabicFontSettings["roles"];
  families: LocalFamily[];
}) {
  const bySlug = (id: string | null) =>
    id ? families.find((f) => f.id === id)?.slug : undefined;

  const display = bySlug(roles.display);
  const body = bySlug(roles.body);
  const eyebrow = bySlug(roles.eyebrow) ?? body;
  const mono = bySlug(roles.mono);

  const face = (slug: string | undefined, fallback: string) =>
    slug ? `"${slug}", ${fallback}` : fallback;

  return (
    <section className="bg-bz-surface border border-bz-border rounded-lg p-6">
      <div className="mb-4 pb-4 border-b border-bz-border">
        <h2 className="text-[15px] font-medium tracking-tight">Specimen</h2>
        <p className="text-[12.5px] text-bz-muted mt-1 leading-[1.55] max-w-[75ch]">
          Live, in the faces above, whether or not they are switched on yet. If
          a line here falls back to a plain system face, that file did not load
          — check that the weight is tagged correctly.
        </p>
      </div>

      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}

      <div
        lang="ar"
        dir="rtl"
        className="rounded-md border border-bz-border bg-bz-bg p-6 flex flex-col gap-4"
      >
        <div
          className="eyebrow"
          style={{ fontFamily: face(eyebrow, "var(--bz-font-ar)") }}
        >
          {SPECIMEN.eyebrow}
        </div>
        <div
          className="text-[34px] leading-[1.35]"
          style={{ fontFamily: face(display, "var(--bz-font-ar)") }}
        >
          {SPECIMEN.display}
        </div>
        <p
          className="text-[15px] text-bz-ink-2 max-w-[62ch]"
          style={{ fontFamily: face(body, "var(--bz-font-ar)") }}
        >
          {SPECIMEN.body}
        </p>
        <p
          className="mono text-[13px] text-bz-ink-2"
          style={{ fontFamily: face(mono, "var(--bz-font-mono)") }}
        >
          {SPECIMEN.mono}
        </p>

        {/* Weights, so a file tagged 700 that is really a 400 is visible as
            two lines that look identical. */}
        <div
          className="flex flex-wrap gap-x-6 gap-y-1 pt-2 border-t border-bz-border text-[17px]"
          style={{ fontFamily: face(body, "var(--bz-font-ar)") }}
        >
          {(["300", "400", "500", "600", "700"] as const).map((w) => (
            <span
              key={w}
              style={{ fontWeight: Number(w) }}
              className={cn("leading-[1.6]")}
            >
              الإمارات{" "}
              <span className="text-[10px] text-bz-muted-2 align-middle">
                {w}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
