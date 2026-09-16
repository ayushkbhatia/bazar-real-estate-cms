"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
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
};

/** `{{token}}` or an absolute address — what a link or button may point at. */
function validTarget(href: string): boolean {
  const v = href.trim();
  return (
    /^\{\{\s*[a-z_]+\s*\}\}$/i.test(v) || /^(https?:\/\/|mailto:|tel:)\S+$/i.test(v)
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
  | { mode: "button"; href: string; text: string; editing: boolean };

export function EmailBodyEditor({
  defaultValue,
  onChange,
  tokens,
  media,
  onMediaUploaded,
  dir = "ltr",
  lang,
}: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [target, setTarget] = useState<TargetDialogState | null>(null);

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

  function openLink(ed: Editor) {
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
    if (target.mode === "link") {
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
      editor
        .chain()
        .focus()
        .setEmailButton({ href, label: target.text.trim() })
        .run();
    }
    setTarget(null);
  }

  const targetValid =
    target !== null &&
    (target.mode === "link"
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
            label="Link"
            active={editor.isActive("link")}
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

      <EditorContent editor={editor} />

      <ImageInsertDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        media={media}
        onUploaded={onMediaUploaded}
        folder="brand"
        captionless
        onInsert={({ src, mediaKey, alt, width }) => {
          editor
            ?.chain()
            .focus()
            .setEmailImage({
              src,
              mediaKey,
              alt,
              // Never wider than the 492px email column.
              width: width ? Math.min(width, 492) : null,
            })
            .run();
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
                    : target.editing
                      ? "Edit button"
                      : "Add a button"}
                </DialogTitle>
                <DialogDescription>
                  {target.mode === "link"
                    ? "Point the selected words at an address, or at a link this email already knows."
                    : "A filled button in the brand colour, on a line of its own."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {target.mode === "button" || target.needsText ? (
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
                  <Input
                    id="target-href"
                    value={target.href}
                    onChange={(e) => setTarget({ ...target, href: e.target.value })}
                    placeholder="https://www.bazarrealestate.ae/contact"
                    className="h-8 text-[12.5px] mono"
                  />
                  <span className="text-[11px] text-bz-muted">
                    A full address starting https://, mailto: or tel:, or one of
                    the links above.
                    {target.mode === "link" ? " Leave empty to remove the link." : ""}
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
