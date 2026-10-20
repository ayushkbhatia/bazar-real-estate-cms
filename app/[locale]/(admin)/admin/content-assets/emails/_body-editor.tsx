"use client";

import { useCallback, useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Undo2,
  Redo2,
  RectangleHorizontal,
  Braces,
  LayoutGrid,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmailButton } from "@/lib/tiptap/email-button";
import { EmailImage } from "@/lib/tiptap/email-image";
import { TokenHighlight } from "@/lib/tiptap/token-highlight";
import type { TokenDef } from "@/lib/content-assets/tokens";
import type { FeatureKind } from "@/lib/content-assets/email-feature";
import type { EmailFeatureAttributes } from "@/lib/tiptap/email-feature";
import { filterRecordOptions } from "../../_fields/record-picker";
import { FeatureDialog, type FeatureChoice, type FeatureRequest } from "./_feature-dialog";
import { EmailFeatureWithView, FeatureEditorContext, type FeatureEditorApi } from "./_feature-view";
import { FEATURE_KIND_META, type FeatureTarget } from "./_feature-types";
import {
  ImageInsertDialog,
  type BlogMediaOption,
} from "../../blog/_image-insert-dialog";

/**
 * The rich-text body of a system email.
 *
 * The extension list is the contract with lib/content-assets/email-html.ts:
 * everything this can produce, that sanitiser keeps, and that renderer knows
 * how to style for an inbox. Adding a mark or node here without adding it
 * there means it is silently stripped on save.
 *
 * Deliberately smaller than the blog editor. No code blocks (no inbox renders
 * them sensibly), headings at two levels, and two email-specific blocks: a
 * button and a plain image.
 *
 * Given `records` (the newsletter composer does), it also offers a third:
 * featured listings, projects, articles and area guides, drawn as cards when
 * the email is rendered — and the link, button and image dialogs can search
 * the site's pages for a target. The sanitiser keeps featured blocks only
 * where they are asked for (`{ features: true }`), so a system email's body
 * can never carry one.
 */

type Props = {
  defaultValue: string;
  onChange: (html: string) => void;
  /** The tokens this email may use, in the order to offer them. */
  tokens: readonly TokenDef[];
  media: BlogMediaOption[];
  onMediaUploaded: (m: BlogMediaOption) => void;
  /**
   * Writing direction of the content area. ProseMirror reads the
   * contenteditable's own `dir`, so setting it on an ancestor is not enough —
   * the caret would start on the wrong side of an Arabic paragraph.
   */
  dir?: "ltr" | "rtl";
  /** Language of the content area, so the Arabic face applies. */
  lang?: string;
  /**
   * The site's published records. Turns on the Feature button and the
   * "page on this site" search in the link dialogs. Newsletters only.
   */
  records?: FeatureTarget[];
};

/**
 * `{{token}}`, an absolute address, or a path on this site (made absolute when
 * the email is rendered) — what a link, button or linked image may point at.
 */
function validTarget(href: string): boolean {
  const v = href.trim();
  return (
    /^\{\{\s*[a-z_]+\s*\}\}$/i.test(v) ||
    /^(https?:\/\/|mailto:|tel:)\S+$/i.test(v) ||
    /^\/(?!\/)\S*$/.test(v)
  );
}

function ToolbarBtn({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 min-w-7 px-1.5 rounded text-[12px] flex items-center justify-center gap-1.5 transition-colors",
        active ? "bg-bz-navy text-bz-bg" : "text-bz-ink-2 hover:bg-bz-surface",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px bg-bz-border mx-0.5 my-1" aria-hidden />;
}

type TargetDialogState =
  | { mode: "link"; href: string; text: string; needsText: boolean }
  | { mode: "button"; href: string; text: string; editing: boolean }
  | { mode: "image"; href: string; text: string };

export function EmailBodyEditor({
  defaultValue,
  onChange,
  tokens,
  media,
  onMediaUploaded,
  dir = "ltr",
  lang,
  records,
}: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [target, setTarget] = useState<TargetDialogState | null>(null);
  const [feature, setFeature] = useState<FeatureRequest | null>(null);
  const [lastKind, setLastKind] = useState<FeatureKind>("property");
  const featuresOn = records !== undefined;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          // A token is a legitimate target: `{{confirm_url}}` is filled in
          // at send time. Tiptap's own validator would refuse it as a URL.
          isAllowedUri: (url, ctx) =>
            /^\{\{\s*[a-z_]+\s*\}\}$/i.test(url) || ctx.defaultValidate(url),
        },
      }),
      EmailButton,
      EmailImage,
      ...(featuresOn ? [EmailFeatureWithView] : []),
      TokenHighlight.configure({ allowed: tokens.map((t) => t.name) }),
    ],
    content: defaultValue || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "tiptap email-body min-h-[360px] px-5 py-4 text-[15px] leading-[1.6] focus:outline-none",
        "aria-label": "Email body",
        dir,
        ...(lang ? { lang } : {}),
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  const textTokens = tokens.filter((t) => t.kind !== "block");
  const blockTokens = tokens.filter((t) => t.kind === "block");
  const urlTokens = tokens.filter((t) => t.kind === "url");

  function insertToken(name: string) {
    if (!editor) return;
    const def = tokens.find((t) => t.name === name);
    if (!def) return;
    if (def.kind === "block") {
      // A panel stands on a line of its own — the renderer swaps the whole
      // paragraph for it.
      editor.chain().focus().insertContent(`<p>{{${name}}}</p>`).run();
    } else {
      editor.chain().focus().insertContent(`{{${name}}}`).run();
    }
  }

  const recordByKey = useMemo(
    () => new Map((records ?? []).map((r) => [`${r.kind}:${r.id}`, r])),
    [records],
  );
  const lookup = useCallback(
    (kind: FeatureKind, id: string) => recordByKey.get(`${kind}:${id}`) ?? null,
    [recordByKey],
  );
  const featureApi = useMemo<FeatureEditorApi>(
    () => ({
      lookup,
      edit: (pos: number, attrs: EmailFeatureAttributes) =>
        setFeature({
          pos,
          initial: { kind: attrs.kind, ids: attrs.ids, layout: attrs.layout, labels: attrs.labels },
        }),
    }),
    [lookup],
  );

  function applyFeature(choice: FeatureChoice) {
    if (!editor || !feature) return;
    setLastKind(choice.kind);
    if (feature.pos === null) {
      editor.chain().focus().insertEmailFeature(choice).run();
    } else {
      editor.chain().focus().updateEmailFeature(feature.pos, choice).run();
    }
    setFeature(null);
  }

  /**
   * Insert a new block (a button, an image). With a block selected — a
   * featured block is selected the moment it is inserted — a plain insert
   * would REPLACE it, so the new block goes after it instead.
   */
  function insertBlock(node: { type: string; attrs: Record<string, unknown> }) {
    if (!editor) return;
    const sel = editor.state.selection;
    if (sel instanceof NodeSelection) editor.chain().focus().insertContentAt(sel.to, node).run();
    else editor.chain().focus().insertContent(node).run();
  }

  function openLink(ed: Editor) {
    if (ed.isActive("emailImage")) {
      setTarget({
        mode: "image",
        href: (ed.getAttributes("emailImage").href as string | null) ?? "",
        text: "",
      });
      return;
    }
    const { from, to } = ed.state.selection;
    setTarget({
      mode: "link",
      href: (ed.getAttributes("link").href as string | undefined) ?? "",
      text: "",
      needsText: from === to && !ed.isActive("link"),
    });
  }

  function openButton(ed: Editor) {
    if (ed.isActive("emailButton")) {
      const attrs = ed.getAttributes("emailButton");
      setTarget({
        mode: "button",
        href: (attrs.href as string) ?? "",
        text: (attrs.label as string) ?? "",
        editing: true,
      });
    } else {
      setTarget({ mode: "button", href: "", text: "", editing: false });
    }
  }

  function applyTarget() {
    if (!editor || !target) return;
    const href = target.href.trim();
    if (target.mode === "image") {
      editor.chain().focus().setEmailImageHref(href || null).run();
    } else if (target.mode === "link") {
      if (href === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else if (target.needsText) {
        const text = target.text.trim() || href;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    } else if (target.editing) {
      editor
        .chain()
        .focus()
        .updateAttributes("emailButton", { href, label: target.text.trim() })
        .run();
    } else {
      insertBlock({ type: "emailButton", attrs: { href, label: target.text.trim() } });
    }
    setTarget(null);
  }

  const targetValid =
    target !== null &&
    (target.mode === "link" || target.mode === "image"
      ? target.href.trim() === "" || validTarget(target.href)
      : validTarget(target.href) && target.text.trim() !== "");

  return (
    <div
      className={cn(
        "border border-bz-border rounded bg-bz-bg overflow-hidden",
        // Email-only blocks and token chips. The article styles in globals.css
        // cover headings, lists, quotes and links.
        "[&_.email-token]:font-mono [&_.email-token]:text-[12.5px] [&_.email-token]:rounded [&_.email-token]:px-1 [&_.email-token]:py-px [&_.email-token]:bg-[oklch(0.94_0.03_220)] [&_.email-token]:text-[oklch(0.38_0.08_230)]",
        "[&_.email-token-bad]:bg-[oklch(0.94_0.05_28)] [&_.email-token-bad]:text-[oklch(0.45_0.13_28)] [&_.email-token-bad]:line-through",
        "[&_a[data-email-button]]:inline-block [&_a[data-email-button]]:my-3 [&_a[data-email-button]]:px-4 [&_a[data-email-button]]:py-2.5 [&_a[data-email-button]]:rounded-md [&_a[data-email-button]]:bg-bz-navy [&_a[data-email-button]]:!text-bz-bg [&_a[data-email-button]]:!no-underline [&_a[data-email-button]]:text-[14px] [&_a[data-email-button]]:font-medium [&_a[data-email-button]]:cursor-pointer",
        "[&_.ProseMirror-selectednode]:outline [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-bz-accent [&_.ProseMirror-selectednode]:outline-offset-2",
        "[&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:my-3",
      )}
    >
      {editor ? (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-bz-border bg-bz-surface-2">
          <ToolbarBtn
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            label="Heading"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Subheading"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            label="Bulleted list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <Divider />
          <ToolbarBtn
            label={editor.isActive("emailImage") ? "Link the image" : "Link"}
            active={editor.isActive("link") || Boolean(editor.isActive("emailImage") && editor.getAttributes("emailImage").href)}
            onClick={() => openLink(editor)}
          >
            <LinkIcon size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label={editor.isActive("emailButton") ? "Edit button" : "Button"}
            active={editor.isActive("emailButton")}
            onClick={() => openButton(editor)}
          >
            <RectangleHorizontal size={13} strokeWidth={1.8} />
            <span className="hidden sm:inline">Button</span>
          </ToolbarBtn>
          <ToolbarBtn label="Image" onClick={() => setImageOpen(true)}>
            <ImageIcon size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          <ToolbarBtn
            label="Divider line"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus size={13} strokeWidth={1.8} />
          </ToolbarBtn>
          {featuresOn ? (
            <>
              <Divider />
              <ToolbarBtn
                label="Feature listings, projects, articles or areas"
                active={editor.isActive("emailFeature")}
                onClick={() => setFeature({ pos: null, initial: null })}
              >
                <LayoutGrid size={13} strokeWidth={1.8} />
                <span className="hidden sm:inline">Feature</span>
              </ToolbarBtn>
            </>
          ) : null}
          <Divider />
          <label className="relative inline-flex items-center h-7 rounded border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2 hover:border-bz-border-strong">
            <Braces
              size={12}
              strokeWidth={1.8}
              className="absolute start-2 pointer-events-none text-bz-muted"
            />
            <span className="sr-only">Insert a field</span>
            <select
              value=""
              onChange={(e) => {
                insertToken(e.target.value);
                e.target.value = "";
              }}
              className="appearance-none bg-transparent h-full ps-6 pe-2 outline-none cursor-pointer"
            >
              <option value="" disabled>
                Insert field…
              </option>
              <optgroup label="Words">
                {textTokens
                  .filter((t) => t.kind === "text")
                  .map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.label}
                    </option>
                  ))}
              </optgroup>
              {urlTokens.length > 0 ? (
                <optgroup label="Addresses">
                  {urlTokens.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {blockTokens.length > 0 ? (
                <optgroup label="Panels (own line)">
                  {blockTokens.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <div className="ms-auto flex gap-0.5">
            <ToolbarBtn
              label="Undo"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={13} strokeWidth={1.8} />
            </ToolbarBtn>
            <ToolbarBtn
              label="Redo"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={13} strokeWidth={1.8} />
            </ToolbarBtn>
          </div>
        </div>
      ) : (
        <div className="h-[41px] border-b border-bz-border bg-bz-surface-2" />
      )}

      <FeatureEditorContext.Provider value={featuresOn ? featureApi : null}>
        <EditorContent editor={editor} />
      </FeatureEditorContext.Provider>

      {records ? (
        <FeatureDialog
          request={feature}
          targets={records}
          defaultKind={lastKind}
          onClose={() => setFeature(null)}
          onChoose={applyFeature}
        />
      ) : null}

      <ImageInsertDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        media={media}
        onUploaded={onMediaUploaded}
        folder="brand"
        captionless
        onInsert={({ src, mediaKey, alt, width }) => {
          insertBlock({
            type: "emailImage",
            attrs: {
              src,
              mediaKey,
              alt,
              // Never wider than the 492px email column.
              width: width ? Math.min(width, 492) : null,
            },
          });
        }}
      />

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          {target ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {target.mode === "link"
                    ? "Link"
                    : target.mode === "image"
                      ? "Link the image"
                      : target.editing
                        ? "Edit button"
                        : "Add a button"}
                </DialogTitle>
                <DialogDescription>
                  {target.mode === "link"
                    ? "Point the selected words at an address, or at a link this email already knows."
                    : target.mode === "image"
                      ? "Where a click on the image goes. Leave empty for a picture that isn't a link."
                      : "A filled button in the brand colour, on a line of its own."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {target.mode === "button" || (target.mode === "link" && target.needsText) ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="target-text">
                      {target.mode === "button" ? "Button text" : "Link text"}
                    </Label>
                    <Input
                      id="target-text"
                      value={target.text}
                      onChange={(e) => setTarget({ ...target, text: e.target.value })}
                      placeholder={
                        target.mode === "button" ? "Confirm subscription" : "Talk to an advisor"
                      }
                      className="h-8 text-[12.5px]"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="target-href">Goes to</Label>
                  {urlTokens.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {urlTokens.map((t) => {
                        const value = `{{${t.name}}}`;
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => setTarget({ ...target, href: value })}
                            aria-pressed={target.href === value}
                            className={cn(
                              "h-6 px-2 rounded border text-[11.5px] transition-colors",
                              target.href === value
                                ? "border-bz-navy bg-bz-navy text-bz-bg"
                                : "border-bz-border text-bz-ink-2 hover:text-bz-ink",
                            )}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {records && records.length > 0 ? (
                    <SitePageSearch
                      records={records}
                      arabic={lang === "ar"}
                      onPick={(path) => setTarget({ ...target, href: path })}
                    />
                  ) : null}
                  <Input
                    id="target-href"
                    value={target.href}
                    onChange={(e) => setTarget({ ...target, href: e.target.value })}
                    placeholder="https://www.bazarrealestate.ae/contact"
                    className="h-8 text-[12.5px] mono"
                  />
                  <span className="text-[11px] text-bz-muted">
                    A full address starting https://, mailto: or tel:
                    {featuresOn ? ", a page found above" : ""}, or one of the
                    links above.
                    {target.mode !== "button" ? " Leave empty to remove the link." : ""}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={applyTarget} disabled={!targetValid}>
                  {target.mode === "button" && !target.editing ? "Add button" : "Apply"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * "A page on this site": search the published listings, projects, articles
 * and area guides and use one's path as the target. The Arabic edition gets
 * the `/ar` page. A path rather than a full address, so it follows the site
 * wherever it is served; the renderer makes it absolute.
 */
function SitePageSearch({
  records,
  arabic,
  onPick,
}: {
  records: FeatureTarget[];
  arabic: boolean;
  onPick: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const matches = q ? (filterRecordOptions(records, q) as FeatureTarget[]).slice(0, 6) : [];
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search
          size={12}
          strokeWidth={1.8}
          aria-hidden
          className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-bz-muted"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a page on the site — a listing, project, article or area"
          aria-label="Find a page on the site"
          className="h-8 ps-7 text-[12.5px]"
        />
      </div>
      {matches.length > 0 ? (
        <ul className="max-h-[180px] overflow-y-auto rounded border border-bz-border p-0.5">
          {matches.map((r) => (
            <li key={`${r.kind}:${r.id}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(`${arabic ? "/ar" : ""}${r.href}`);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-start text-[12px] hover:bg-bz-surface-2"
              >
                <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-bz-muted">
                  {FEATURE_KIND_META[r.kind].noun}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="mono shrink-0 truncate text-[10.5px] text-bz-muted max-w-[40%]">{r.href}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : q ? (
        <span className="text-[11px] text-bz-muted">No published page matches “{q}”.</span>
      ) : null}
    </div>
  );
}
