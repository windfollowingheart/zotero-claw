/**
 * ZoteroClaw Chat - Markdown Renderer
 *
 * Simple markdown renderer for chat messages.
 * Supports: headers, bold, italic, code (inline and block), links, lists
 */

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Parse inline markdown elements
 */
function parseInline(text: string): string {
  // Escape HTML first
  let result = escapeHtml(text);

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");

  // Inline code: `text`
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="chat-inline-code">$1</code>',
  );

  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank">$1</a>',
  );

  return result;
}

/**
 * Parse code blocks
 */
function parseCodeBlocks(text: string): string {
  // Fenced code blocks: ```lang\n code \n```
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = escapeHtml(code.trim());
    const langClass = lang ? `language-${lang}` : "";
    return `<pre class="chat-code-block ${langClass}"><code>${escapedCode}</code></pre>`;
  });
}

/**
 * Parse headers
 */
function parseHeaders(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let processed = line;

    // Headers: # text, ## text, ### text
    const headerMatch = processed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = parseInline(headerMatch[2]);
      processed = `<h${level} class="chat-header">${content}</h${level}>`;
    }

    result.push(processed);
  }

  return result.join("\n");
}

/**
 * Parse lists
 */
function parseLists(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  for (const line of lines) {
    // Unordered list: - text or * text
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    // Ordered list: 1. text
    const olMatch = line.match(/^\d+\.\s+(.+)$/);

    if (ulMatch || olMatch) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const content = parseInline(ulMatch ? ulMatch[1] : olMatch![1]);
      listItems.push(`<li>${content}</li>`);
    } else {
      if (inList && listItems.length > 0) {
        const listTag = ulMatch ? "ul" : "ol";
        result.push(
          `<${listTag} class="chat-list">${listItems.join("\n")}</${listTag}>`,
        );
        listItems = [];
        inList = false;
      }
      result.push(line);
    }
  }

  // Handle remaining list
  if (inList && listItems.length > 0) {
    result.push(`<ul class="chat-list">${listItems.join("\n")}</ul>`);
  }

  return result.join("\n");
}

/**
 * Parse paragraphs - wrap non-special lines in <p>
 */
function parseParagraphs(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === "") {
      result.push("");
      continue;
    }

    // Skip already processed elements
    if (
      line.startsWith("<h") ||
      line.startsWith("<pre") ||
      line.startsWith("<ul") ||
      line.startsWith("<ol") ||
      line.startsWith("<li") ||
      line.startsWith("<strong") ||
      line.startsWith("<em")
    ) {
      result.push(line);
      continue;
    }

    // Wrap in paragraph
    result.push(`<p class="chat-paragraph">${parseInline(line)}</p>`);
  }

  return result.join("\n");
}

/**
 * Render markdown to HTML
 *
 * @param text - Markdown text to render
 * @returns HTML string
 */
export function renderMarkdown(text: string): string {
  if (!text || text.trim() === "") {
    return "";
  }

  let result = text;

  // Parse code blocks first (they may contain markdown syntax)
  result = parseCodeBlocks(result);

  // Parse headers
  result = parseHeaders(result);

  // Parse lists
  result = parseLists(result);

  // Parse paragraphs
  result = parseParagraphs(result);

  // Clean up empty paragraphs and extra whitespace
  result = result.replace(/<p class="chat-paragraph">\s*<\/p>/g, "");
  result = result.replace(/\n\n+/g, "\n");

  return result;
}

/**
 * Render plain text (for user messages)
 *
 * @param text - Plain text to render
 * @returns HTML string
 */
export function renderPlainText(text: string): string {
  if (!text || text.trim() === "") {
    return "";
  }

  // Escape HTML and preserve line breaks
  const escaped = escapeHtml(text);
  // return escaped.replace(/\n/g, '<br>');
  return escaped;
}

/**
 * Create markdown renderer instance
 */
export function createMarkdownRenderer(): typeof renderMarkdown {
  return renderMarkdown;
}
