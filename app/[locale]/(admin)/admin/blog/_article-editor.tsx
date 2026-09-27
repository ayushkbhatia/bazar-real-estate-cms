"use client";

import { useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Signpost,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { articleExtensions } from "@/lib/tiptap/article-extensions";
import type { InternalLinkAttributes } from "@/lib/tiptap/internal-link";
import {
  isInternalLinkKind,
  linkKey,
} from "@/lib/internal-links/model";
import type { InternalLinkTarget } from "@/lib/internal-links/types";
import {
  ImageInsertDialog,
  type BlogMediaOption,
} from "./_image-insert-dialog";
import {
  InternalLinkDialog,
  type InternalLinkChoice,
  type InternalLinkRequest,
} from "./_internal-link-dialog";
import {
  InternalLinkEditorContext,
  InternalLinkWithView,
  type InternalLinkEditorApi,
} from "./_internal-link-view";

/** The picker, opened on an existing block. */
function editBlockRequest(
  pos: number,
  attrs: InternalLinkAttributes,
): InternalLinkRequest {
  return {
    mode: "edit-block",
    hasTextSelection: false,
    pos,
    initial: { kind: attrs.kind, id: attrs.targetId, as: attrs.variant },
  };
}

type ArticleEditorProps = {
  /** Initial HTML — should be the persisted value from the DB. */
  defaultValue: string;
  /** Called with the latest HTML after every change. */
  onChange: (html: string) => void;
  /** Library images offered by the insert dialog. */
  media: BlogMediaOption[];
  /** Bubbles a fresh upload up so the picker lists it without a refresh. */
  onMediaUploaded: (m: BlogMediaOption) => void;
  /**
   * Every published area, project and listing, for the internal-link picker
   * and for naming the records the body's link blocks point at.
   */
  linkTargets: InternalLinkTarget[];
  /**
   * Writing direction for the content area. The Arabic body passes "rtl" so
   * the caret starts on the right and paragraphs align correctly while typing
   * — ProseMirror reads the contenteditable's own `dir`, so setting it on an
   * ancestor is not enough.
   */
  dir?: "ltr" | "rtl";
  /** Language of the content area, so the Arabic font stack applies. */
  lang?: string;
};

function ToolbarBtn({
  active,
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "h-7 px-2 rounded text-[12.5px] flex items-center gap-1.5 transition-colors",
        active
          ? "bg-bz-navy text-bz-bg"
          : "text-bz-ink-2 hover:bg-bz-surface-2",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  onInsertImage,
  onInternalLink,
}: {
  editor: Editor | null;
  onInsertImage: () => void;
  onInternalLink: () => void;
}) {
  if (!editor) return null;

  const internalLinkActive =
    editor.isActive("internalLink") ||
    (editor.isActive("link") && Boolean(editor.getAttributes("link").linkKind));

  function setLink() {
    if (!editor) return;
    // A link to one of our own records is edited through the picker, so it
    // keeps pointing at the record rather than at whatever URL gets typed.
    if (editor.isActive("link") && editor.getAttributes("link").linkKind) {
      onInternalLink();
      return;
    }
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setExternalLink(url).run();
  }

  return (
    <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-bz-border bg-bz-surface-2 rounded-t">
      <ToolbarBtn
        ariaLabel="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <div className="w-px bg-bz-border mx-1 my-1" />
      <ToolbarBtn
        ariaLabel="Heading level 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Heading level 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <div className="w-px bg-bz-border mx-1 my-1" />
      <ToolbarBtn
        ariaLabel="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <div className="w-px bg-bz-border mx-1 my-1" />
      <ToolbarBtn ariaLabel="Add link" onClick={setLink} active={editor.isActive("link")}>
        <LinkIcon size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Internal link — an area, project or listing"
        active={internalLinkActive}
        onClick={onInternalLink}
      >
        <Signpost size={13} strokeWidth={1.8} />
        <span className="hidden sm:inline">Internal link</span>
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Insert image"
        active={editor.isActive("figureImage")}
        onClick={onInsertImage}
      >
        <ImageIcon size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <ToolbarBtn
        ariaLabel="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={13} strokeWidth={1.8} />
      </ToolbarBtn>
      <div className="ms-auto flex gap-1">
        <ToolbarBtn
          ariaLabel="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={13} strokeWidth={1.8} />
        </ToolbarBtn>
        <ToolbarBtn
          ariaLabel="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={13} strokeWidth={1.8} />
        </ToolbarBtn>
      </div>
    </div>
  );
}

export function ArticleEditor({
  defaultValue,
  onChange,
  media,
  onMediaUploaded,
  linkTargets,
  dir = "ltr",
  lang,
}: ArticleEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkRequest, setLinkRequest] = useState<InternalLinkRequest | null>(
    null,
  );

  const linkApi = useMemo<InternalLinkEditorApi>(() => {
    const byKey = new Map(linkTargets.map((t) => [linkKey(t.kind, t.id), t]));
    return {
      lookup: (kind, id) => byKey.get(linkKey(kind, id)) ?? null,
      edit: (pos, attrs) => setLinkRequest(editBlockRequest(pos, attrs)),
    };
  }, [linkTargets]);

  // Built once. The editor only reads its extensions at creation, and a fresh
  // array on every render made `useEditor` push new options into it each time.
  const [extensions] = useState(() =>
    articleExtensions({ internalLink: InternalLinkWithView }),
  );

  const editor = useEditor({
    extensions,
    content: defaultValue || "<p></p>",
    editorProps: {
      attributes: {
        // Internal text links get a dashed underline, so an editor can tell
        // them from links to other sites at a glance.
        class:
          "tiptap min-h-[420px] px-5 py-4 text-[15.5px] leading-[1.65] focus:outline-none [&_a[data-link-kind]]:decoration-dashed",
        dir,
        ...(lang ? { lang } : {}),
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  /**
   * What the toolbar button means depends on where the cursor is: on a block,
   * edit it; inside an internal text link, re-point it; over selected words,
   * offer to link them; anywhere else, insert a block.
   */
  function openInternalLink() {
    if (!editor) return;
    const { selection } = editor.state;
    if (
      selection instanceof NodeSelection &&
      selection.node.type.name === "internalLink"
    ) {
      setLinkRequest(
        editBlockRequest(
          selection.from,
          selection.node.attrs as InternalLinkAttributes,
        ),
      );
      return;
    }
    const link = editor.getAttributes("link");
    if (editor.isActive("link") && isInternalLinkKind(link.linkKind)) {
      setLinkRequest({
        mode: "edit-text",
        hasTextSelection: true,
        initial: { kind: link.linkKind, id: link.linkId ?? null, as: "text" },
      });
      return;
    }
    setLinkRequest({
      mode: "insert",
      hasTextSelection: !selection.empty,
      initial: null,
    });
  }

  function applyInternalLink({ target, as }: InternalLinkChoice) {
    const request = linkRequest;
    setLinkRequest(null);
    if (!editor || !request) return;
    if (as === "text") {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setInternalTextLink({
          href: target.href,
          kind: target.kind,
          id: target.id,
        })
        .run();
      return;
    }
    const attrs = {
      kind: target.kind,
      targetId: target.id,
      variant: as,
      label: target.name,
    };
    if (request.mode === "edit-block" && request.pos !== undefined) {
      editor.chain().focus().updateInternalLink(request.pos, attrs).run();
    } else {
      editor.chain().focus().insertInternalLink(attrs).run();
    }
  }

  return (
    <div className="border border-bz-border rounded bg-bz-bg overflow-hidden">
      <Toolbar
        editor={editor}
        onInsertImage={() => setPickerOpen(true)}
        onInternalLink={openInternalLink}
      />
      <InternalLinkEditorContext.Provider value={linkApi}>
        <EditorContent editor={editor} />
      </InternalLinkEditorContext.Provider>
      <InternalLinkDialog
        request={linkRequest}
        targets={linkTargets}
        onClose={() => {
          setLinkRequest(null);
          editor?.commands.focus();
        }}
        onChoose={applyInternalLink}
        onUnlink={() => {
          setLinkRequest(null);
          editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        }}
      />
      <ImageInsertDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        media={media}
        onUploaded={onMediaUploaded}
        onInsert={({ src, mediaKey, alt, width, height, caption }) => {
          editor
            ?.chain()
            .focus()
            .setFigureImage({ src, mediaKey, alt, width, height, caption })
            .run();
        }}
      />
    </div>
  );
}
