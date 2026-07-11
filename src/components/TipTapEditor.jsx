import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ImagePlus,
  Quote,
  Minus,
} from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { uploadImage } from '../lib/storage';

/**
 * Insert an image file into the editor.
 * Uploads to Supabase Storage (or falls back to base64).
 * Returns true if the event should be consumed (prevented).
 */
async function insertImageFile(file, editor) {
  if (!file || !file.type.startsWith('image/') || !editor) return false;
  try {
    const url = await uploadImage(file);
    editor.chain().focus().setImage({ src: url }).run();
  } catch (err) {
    alert(err.message || '图片上传失败');
  }
  return true;
}

/**
 * Extract the first image File from a DataTransfer (paste or drop).
 */
function getImageFromTransfer(dt) {
  if (!dt) return null;
  // Check files first (drag & drop, some paste cases)
  for (const file of dt.files) {
    if (file.type.startsWith('image/')) return file;
  }
  // Check items (clipboard paste)
  for (const item of dt.items) {
    if (item.type.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

/**
 * Toolbar button — minimal, consistent sizing.
 */
function ToolbarBtn({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors duration-fast ease-out shrink-0
        ${active
          ? 'bg-surface-active text-ink'
          : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
        }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}

/**
 * Fixed top toolbar for the editor.
 * Sticky at top of scroll container with backdrop blur.
 * Horizontal scroll on mobile to prevent button overflow.
 */
function EditorToolbar({ editor, fileInputRef }) {
  if (!editor) return null;

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-0.5 px-2 py-1.5
        bg-surface/80 backdrop-blur-md border-b border-border
        overflow-x-auto scrollbar-none"
    >
      {/* Inline formatting */}
      <ToolbarBtn
        title="加粗"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="斜体"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="下划线"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarBtn
        title="标题 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="标题 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Block elements */}
      <ToolbarBtn
        title="引用"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="无序列表"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="有序列表"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Insert */}
      <ToolbarBtn
        title="插入图片"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus size={15} />
      </ToolbarBtn>
      <ToolbarBtn
        title="分割线"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={15} />
      </ToolbarBtn>
    </div>
  );
}

/**
 * TipTap editor — FULLY UNCONTROLLED.
 *
 * Content is injected exactly once on mount. After that, the editor owns its
 * own state. No external prop can overwrite the content while the user is
 * editing. This eliminates the "data rollback" bug caused by auto-save
 * feedback loops.
 *
 * Props:
 *   - content: TipTap JSON — used ONLY on initial mount
 *   - onUpdate: (json) => void — fires immediately on every change (no debounce here)
 *   - onBlur: () => void — fires when editor loses focus (for immediate save)
 *   - placeholder: string
 *   - autoFocus: boolean
 */
export default function TipTapEditor({
  content,
  onUpdate,
  onBlur,
  placeholder = '开始书写…',
  autoFocus = false,
}) {
  const onUpdateRef = useRef(onUpdate);
  const onBlurRef = useRef(onBlur);
  const isComposingRef = useRef(false);
  const isInitialLoadedRef = useRef(false);
  const fileInputRef = useRef(null);

  // Keep callback refs in sync without causing re-renders
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true }),
      Underline,
    ],
    // Initial content — only used at creation time
    content: content || undefined,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[60vh] outline-none',
      },
      handleDOMEvents: {
        compositionstart: () => {
          isComposingRef.current = true;
          return false;
        },
        compositionend: () => {
          isComposingRef.current = false;
          return false;
        },
        // Clipboard paste — intercept image data
        paste: (_view, event) => {
          const file = getImageFromTransfer(event.clipboardData);
          if (file) {
            event.preventDefault();
            insertImageFile(file, editor);
            return true;
          }
          return false;
        },
        // Drag & drop — intercept image files
        drop: (_view, event) => {
          const file = getImageFromTransfer(event.dataTransfer);
          if (file) {
            event.preventDefault();
            insertImageFile(file, editor);
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      // Never fire during IME composition
      if (isComposingRef.current) return;
      // Fire immediately — debounce is handled by the parent (DiaryEditor)
      onUpdateRef.current?.(editor.getJSON());
    },
    onBlur: () => {
      // Notify parent for immediate save on blur
      onBlurRef.current?.();
    },
  });

  // ─── UNCONTROLLED: inject content exactly once, then never again ───
  useEffect(() => {
    if (!editor) return;
    if (isInitialLoadedRef.current) return; // already loaded — reject all future content
    if (!content) return;

    isInitialLoadedRef.current = true;
    editor.commands.setContent(content);
  }, [editor]); // deliberately NOT depending on `content`

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInitialLoadedRef.current = false;
    };
  }, []);

  // Handle file input change (toolbar upload button)
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) insertImageFile(file, editor);
      e.target.value = '';
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="relative">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <EditorToolbar editor={editor} fileInputRef={fileInputRef} />
      <EditorContent editor={editor} />
    </div>
  );
}
