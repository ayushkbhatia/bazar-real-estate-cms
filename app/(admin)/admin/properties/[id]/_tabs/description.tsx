"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Quote, Link2 } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7c (backfilled): Tiptap long-description editor on the property
 * edit form. Bold / italic / lists / blockquote / link toolbar. Parent
 * passes initial HTML and an onChange handler — Sprint 9 wires autosave
 * through this onChange callback.
 */
export function PropertyDescriptionTab({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
    ],
    content: initialHtml || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div>
      <Eyebrow>Long description</Eyebrow>
      <p className="mt-2 text-[12px] text-bz-muted">
        Editor copy renders on the public property page. Keep it tight —
        the design favours one or two paragraphs of advisor commentary,
        not a feature dump.
      </p>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-t-md border border-bz-border bg-bz-surface px-2 py-1.5">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold size={13} strokeWidth={1.7} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic size={13} strokeWidth={1.7} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bulleted list"
        >
          <List size={13} strokeWidth={1.7} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered size={13} strokeWidth={1.7} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
        >
          <Quote size={13} strokeWidth={1.7} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt(
              "URL",
              editor.getAttributes("link").href ?? "https://",
            );
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }}
          label="Link"
        >
          <Link2 size={13} strokeWidth={1.7} />
        </ToolbarBtn>
      </div>

      <EditorContent
        editor={editor}
        className="min-h-[280px] rounded-b-md border-x border-b border-bz-border bg-bz-bg px-4 py-3 text-[14.5px] leading-relaxed [&_p]:my-2 [&_h2]:serif [&_h2]:text-[20px] [&_h2]:my-3 [&_h3]:serif [&_h3]:text-[16px] [&_blockquote]:border-l-2 [&_blockquote]:border-bz-accent [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-bz-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
      />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={
        active
          ? "w-7 h-7 rounded bg-bz-ink text-bz-bg flex items-center justify-center"
          : "w-7 h-7 rounded text-bz-ink-2 hover:bg-bz-bg flex items-center justify-center"
      }
    >
      {children}
    </button>
  );
}
