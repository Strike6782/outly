"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Code, Undo2, Redo2,
  Link as LinkIcon, Unlink, Highlighter, Minus, Type,
  Heading1, Heading2, Heading3, RemoveFormatting,
} from "lucide-react";

interface EditorProps {
  value?: string;
  onChange: (html: string) => void;
}

/* 44px minimum touch target on mobile, compact on desktop */
function ToolbarButton({
  onClick, isActive = false, disabled = false, children, title,
}: {
  onClick: () => void; isActive?: boolean; disabled?: boolean;
  children: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        h-10 w-10 md:h-8 md:w-8 flex-shrink-0
        flex items-center justify-center rounded-lg md:rounded-md
        transition-all duration-150 active:scale-95
        ${isActive
          ? "bg-blue-100 text-blue-700"
          : disabled
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200"
        }
      `}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 md:mx-1 h-5 w-px bg-gray-200 flex-shrink-0" />;
}

function LinkModal({
  onSubmit, onClose, initialUrl = "",
}: {
  onSubmit: (url: string) => void; onClose: () => void; initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-xl shadow-xl p-5 w-full max-w-sm md:mx-4 pb-8 md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Insert Link</h3>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full px-3 py-3 md:py-2 text-base md:text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && url) onSubmit(url);
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 md:py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={() => url && onSubmit(url)} disabled={!url}
            className="px-4 py-2.5 md:py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

const FONT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Gray", value: "#6b7280" },
];

export function Editor({ value = "", onChange }: EditorProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-600 underline cursor-pointer" },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Write your email..." }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] md:min-h-[380px] px-3 md:px-5 py-3 md:py-5 text-sm text-gray-800 outline-none leading-relaxed " +
          "prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 " +
          "prose-blockquote:border-l-blue-400 prose-blockquote:text-gray-600 " +
          "prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-pink-600 prose-code:text-xs " +
          "prose-a:text-blue-600 prose-a:underline",
      },
    },
  });

  useEffect(() => {
    if (editor && value && !editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const setLink = useCallback((url: string) => {
    if (!editor) return;
    const href = url.startsWith("http") ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setShowLinkModal(false);
  }, [editor]);

  if (!editor) return null;

  const iconSize = "h-4 w-4";

  return (
    <div className="relative">
      {/* Toolbar — horizontally scrollable on mobile, wraps on desktop */}
      <div className="overflow-x-auto md:overflow-x-visible scrollbar-none">
        <div className="flex items-center gap-0.5 px-2 md:px-3 py-2 border-b border-gray-100 bg-gray-50/50 md:flex-wrap min-w-max md:min-w-0">
          {/* Undo / Redo */}
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <Undo2 className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
            <Redo2 className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Text type — hidden on mobile, shown on desktop */}
          <div className="hidden md:flex items-center gap-0.5">
            <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()}
              isActive={editor.isActive("paragraph") && !editor.isActive("heading")} title="Normal text">
              <Type className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
              <Heading1 className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
              <Heading2 className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
              <Heading3 className={iconSize} />
            </ToolbarButton>
            <ToolbarDivider />
          </div>

          {/* Inline formatting */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
            <Bold className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
            <Italic className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
            <UnderlineIcon className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
            <Strikethrough className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Color & highlight */}
          <div className="relative">
            <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} isActive={showColorPicker} title="Text color">
              <div className="flex flex-col items-center">
                <Type className="h-3.5 w-3.5" />
                <div className="h-0.5 w-3.5 rounded-full mt-0.5"
                  style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000" }} />
              </div>
            </ToolbarButton>
            {showColorPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 flex gap-1.5">
                {FONT_COLORS.map((c) => (
                  <button key={c.label} type="button" title={c.label}
                    onClick={() => {
                      c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run();
                      setShowColorPicker(false);
                    }}
                    className="h-7 w-7 md:h-6 md:w-6 rounded-full border border-gray-200 hover:scale-110 active:scale-95 transition-transform"
                    style={{ backgroundColor: c.value || "#1f2937" }} />
                ))}
              </div>
            )}
          </div>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
            isActive={editor.isActive("highlight")} title="Highlight">
            <Highlighter className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()}
            isActive={editor.isActive({ textAlign: "left" })} title="Align left">
            <AlignLeft className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()}
            isActive={editor.isActive({ textAlign: "center" })} title="Align center">
            <AlignCenter className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()}
            isActive={editor.isActive({ textAlign: "right" })} title="Align right">
            <AlignRight className={iconSize} />
          </ToolbarButton>
          {/* Justify hidden on mobile to save space */}
          <div className="hidden md:block">
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              isActive={editor.isActive({ textAlign: "justify" })} title="Justify">
              <AlignJustify className={iconSize} />
            </ToolbarButton>
          </div>

          <ToolbarDivider />

          {/* Lists & blocks */}
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")} title="Bullet list">
            <List className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")} title="Numbered list">
            <ListOrdered className={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")} title="Blockquote">
            <Quote className={iconSize} />
          </ToolbarButton>
          {/* Code & HR hidden on mobile */}
          <div className="hidden md:flex items-center gap-0.5">
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")} title="Inline code">
              <Code className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
              <Minus className={iconSize} />
            </ToolbarButton>
          </div>

          <ToolbarDivider />

          {/* Link */}
          <ToolbarButton
            onClick={() => editor.isActive("link") ? editor.chain().focus().unsetLink().run() : setShowLinkModal(true)}
            isActive={editor.isActive("link")}
            title={editor.isActive("link") ? "Remove link" : "Insert link"}>
            {editor.isActive("link") ? <Unlink className={iconSize} /> : <LinkIcon className={iconSize} />}
          </ToolbarButton>

          {/* Clear formatting */}
          <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
            <RemoveFormatting className={iconSize} />
          </ToolbarButton>
        </div>
      </div>

      {/* Mobile heading row — only visible on small screens */}
      <div className="flex md:hidden items-center gap-0.5 px-2 py-1.5 border-b border-gray-50 bg-gray-50/30">
        <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive("paragraph") && !editor.isActive("heading")} title="Normal text">
          <Type className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className={iconSize} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")} title="Inline code">
          <Code className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Link modal — slides up from bottom on mobile */}
      {showLinkModal && (
        <LinkModal
          initialUrl={editor.getAttributes("link").href || ""}
          onSubmit={setLink}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
