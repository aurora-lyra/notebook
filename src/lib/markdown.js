/**
 * Markdown serializer and parser for TipTap/ProseMirror JSON.
 *
 * Covers the same node types as TipTap StarterKit + Image:
 *   doc, paragraph, heading (1-3), text, bold, italic, strike, underline,
 *   code, codeBlock, blockquote, bulletList, orderedList, listItem,
 *   hardBreak, horizontalRule, image
 *
 * Zero external dependencies — pure string processing.
 */

// ─── Serializer (TipTap JSON → Markdown) ──────────────────────────────

/**
 * Serialize a ProseMirror node to markdown text.
 */
export function serialize(node) {
  if (!node) return '';
  const result = serializeNode(node);
  return result.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function serializeNode(node) {
  if (!node) return '';
  const { type, attrs, content, marks, text } = node;

  // Text node
  if (type === 'text' && text != null) {
    return applyMarks(text, marks || []);
  }

  // Leaf nodes
  if (type === 'hardBreak') return '\n';
  if (type === 'horizontalRule') return '\n---\n\n';
  if (type === 'image') {
    return `![${attrs?.alt || ''}](${attrs?.src || ''})`;
  }

  // Container nodes
  const inner = (content || []).map((child) => serializeNode(child)).join('');

  switch (type) {
    case 'doc':
      return inner;
    case 'paragraph':
      return inner + '\n\n';
    case 'heading': {
      const level = attrs?.level || 1;
      return '#'.repeat(level) + ' ' + inner + '\n\n';
    }
    case 'blockquote':
      return inner
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n') + '\n\n';
    case 'codeBlock': {
      const lang = attrs?.language || '';
      return '```' + lang + '\n' + inner.trimEnd() + '\n```\n\n';
    }
    case 'bulletList':
      return (content || [])
        .map((item) => serializeListItem(item, false, 0))
        .join('');
    case 'orderedList':
      return (content || [])
        .map((item, i) => serializeListItem(item, true, i))
        .join('');
    case 'listItem':
      // Fallback — should be handled by serializeListItem
      return serializeListItem(node, false, 0);
    default:
      return inner;
  }
}

/**
 * Serialize a listItem node. Called by bulletList/orderedList.
 * Handles indentation of continuation lines and nested list content.
 */
function serializeListItem(node, isOrdered, index) {
  const prefix = isOrdered ? `${index + 1}. ` : '- ';
  const lines = [];

  for (const child of node.content || []) {
    if (child.type === 'paragraph') {
      const text = (child.content || []).map((n) => serializeNode(n)).join('');
      lines.push(text);
    } else if (child.type === 'bulletList') {
      for (const item of child.content || []) {
        lines.push(serializeListItem(item, false, 0));
      }
    } else if (child.type === 'orderedList') {
      for (const [i, item] of (child.content || []).entries()) {
        lines.push(serializeListItem(item, true, i));
      }
    } else {
      lines.push(serializeNode(child));
    }
  }

  return lines
    .map((line, i) => {
      const textLines = line.split('\n');
      return textLines
        .map((tl, j) => (i === 0 && j === 0 ? prefix + tl : '  ' + tl))
        .join('\n');
    })
    .join('\n') + '\n';
}

/**
 * Apply bold/italic/strike/code marks to text.
 * Bold is applied before italic so that `***text***` renders correctly.
 */
function applyMarks(text, marks) {
  let result = text;

  // Sort marks: bold first, then the rest in original order
  const sorted = [...marks].sort((a, b) => {
    const order = { bold: 0, italic: 1, strike: 2, code: 3, underline: 4 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  for (const mark of sorted) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      // underline has no markdown equivalent — skip
      default:
        break;
    }
  }

  return result;
}

// ─── Parser (Markdown → TipTap JSON) ──────────────────────────────────

/**
 * Parse a markdown string into a ProseMirror JSON document.
 */
export function parse(md) {
  if (!md || typeof md !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  }

  const lines = md.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (!line.trim()) { i++; continue; }

    // Code block
    const cbMatch = line.match(/^```(\w*)/);
    if (cbMatch) {
      const lang = cbMatch[1] || undefined;
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'codeBlock',
        attrs: lang ? { language: lang } : undefined,
        content: codeLines.join('\n'),
      });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Unordered list
    if (/^[\-\*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'bulletList', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'orderedList', items });
      continue;
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      blocks.push({ type: 'image', attrs: { alt: imgMatch[1], src: imgMatch[2] } });
      i++;
      continue;
    }

    // Paragraph (default)
    blocks.push({ type: 'paragraph', content: line });
    i++;
  }

  // Convert blocks to ProseMirror nodes
  const nodes = blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return {
          type: 'heading',
          attrs: block.attrs,
          content: parseInline(block.content),
        };
      case 'paragraph':
        return { type: 'paragraph', content: parseInline(block.content) };
      case 'blockquote':
        return {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: parseInline(block.content) },
          ],
        };
      case 'codeBlock':
        return {
          type: 'codeBlock',
          attrs: block.attrs,
          content: block.content ? [{ type: 'text', text: block.content }] : [],
        };
      case 'bulletList':
        return {
          type: 'bulletList',
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: parseInline(item) }],
          })),
        };
      case 'orderedList':
        return {
          type: 'orderedList',
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: parseInline(item) }],
          })),
        };
      case 'horizontalRule':
        return { type: 'horizontalRule' };
      case 'image':
        return { type: 'image', attrs: block.attrs };
      default:
        return { type: 'paragraph', content: [] };
    }
  });

  // Filter out empty paragraphs
  const filtered = nodes.filter((n) => {
    if (n.type !== 'paragraph') return true;
    return n.content && n.content.length > 0;
  });

  return { type: 'doc', content: filtered.length > 0 ? filtered : [{ type: 'paragraph', content: [] }] };
}

/**
 * Parse inline markdown formatting: **bold**, *italic*, ~~strike~~, `code`.
 * Returns an array of ProseMirror text nodes with marks.
 */
function parseInline(text) {
  if (!text || typeof text !== 'string') return [];

  // Pattern matches: **bold**, *italic*, ~~strike~~, `code`
  const inlinePattern = /\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`/g;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = inlinePattern.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1] != null) {
      // **bold**
      nodes.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] });
    } else if (match[2] != null) {
      // *italic*
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'italic' }] });
    } else if (match[3] != null) {
      // ~~strike~~
      nodes.push({ type: 'text', text: match[3], marks: [{ type: 'strike' }] });
    } else if (match[4] != null) {
      // `code`
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes;
}
