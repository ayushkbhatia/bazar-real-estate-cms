"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
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
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FigureImage } from "@/lib/tiptap/figure-image";
import {
  ImageInsertDialog,
  type BlogMediaOption,
} from "./_image-insert-dialog";

type ArticleEditorProps = {
  /** Initial HTML — should be the persisted value from the DB. */
  defaultValue: string;
  /** Called with the latest HTML after every change. */
  onChange: (html: string) => void;
  /** Library images offered by the insert dialog. */
  media: BlogMediaOption[];
  /** Bubbles a fresh upload up so the picker lists it without a refresh. */
  onMediaUploaded: (m: BlogMediaOption) => void;
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
}: {
  editor: Editor | null;
  onInsertImage: () => void;
}) {
  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
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
}: ArticleEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      FigureImage,
    ],
    content: defaultValue || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[420px] px-5 py-4 text-[15.5px] leading-[1.65] focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  return (
    <div className="border border-bz-border rounded bg-bz-bg overflow-hidden">
      <Toolbar editor={editor} onInsertImage={() => setPickerOpen(true)} />
      <EditorContent editor={editor} />
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
