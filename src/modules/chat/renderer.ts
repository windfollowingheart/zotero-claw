/**
 * ZoteroClaw Chat - Markdown Renderer
 *
 * Uses 'marked' library for markdown rendering.
 * Configured for XHTML compatibility in Zotero.
 */

import { marked } from "marked";

/**
 * Configure marked options
 */
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Disable HTML blocks in source text
const tokenizer = {
  html(_src: string): undefined {
    // Return undefined to skip HTML tokenization
    // This prevents raw HTML in source from being rendered
    return undefined;
  },
};

marked.use({ tokenizer });

/**
 * Post-process HTML for XHTML compatibility
 */
function xhtmlify(html: string): string {
  // Convert self-closing tags to XHTML format
  html = html.replace(/<br>/gi, "<br/>");
  html = html.replace(/<hr>/gi, "<hr/>");
  return html;
}

/**
 * Render markdown to HTML (XHTML compatible)
 * Raw HTML in source is ignored, only markdown syntax is rendered
 *
 * @param text - Markdown text to render
 * @returns HTML string
 */
export function renderMarkdown(text: string): string {
  if (!text || text.trim() === "") {
    return "";
  }

  try {
    const html = marked.parse(text, { async: false }) as string;
    return xhtmlify(html);
  } catch (e) {
    console.error("Markdown rendering error:", e);
    return renderPlainText(text);
  }
}

/**
 * Render plain text (for user messages and collapsible content)
 *
 * @param text - Plain text to render
 * @returns HTML string (fully escaped)
 */
export function renderPlainText(text: string): string {
  if (!text || text.trim() === "") {
    return "";
  }

  // Escape all HTML characters and preserve whitespace
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}
