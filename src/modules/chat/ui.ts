/**
 * ZoteroClaw Chat - UI Components
 *
 * Factory functions for creating chat UI elements using native DOM API
 */

import type {
  AgentMessage,
  BackendMessage,
  ChatSession,
  ChatUIState,
  FileAttachment,
  MessageRenderState,
  StoredMessage,
  UIMessageType,
  UserMessage,
  WSChatMessage,
  WSRequest,
  WSResponse,
} from "./types";
import { chatAPI } from "./api";
import { renderMarkdown } from "./renderer";

/**
 * Generate unique ID using UUID (first 8 characters)
 */
function generateId(): string {
  const uuid = crypto.randomUUID();
  return uuid.substring(0, 8);
}

/**
 * Get or create session ID from prefs
 * If prefs has no session_id, generate one and save it
 */
function getOrCreateSessionId(): string {
  const prefsKey = "extensions.zoteroclaw.chat.session_id";
  let sessionId = Zotero.Prefs.get(prefsKey) as string;

  if (!sessionId || sessionId.trim() === "") {
    // Generate new session ID
    const uuid = crypto.randomUUID();
    sessionId = uuid.substring(0, 8);
    // Save to prefs
    Zotero.Prefs.set(prefsKey, sessionId);
    ztoolkit.log("Generated new session_id:", sessionId);
  }

  return sessionId;
}

/**
 * Helper to create element with properties
 */
function createElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tagName: K,
  options: {
    id?: string;
    classList?: string[];
    properties?: Partial<HTMLElementTagNameMap[K]>;
    children?: HTMLElement[];
    innerHTML?: string;
    textContent?: string;
  } = {},
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tagName);

  if (options.id) el.id = options.id;
  if (options.classList) el.classList.add(...options.classList);
  if (options.properties) {
    Object.assign(el, options.properties);
  }
  if (options.innerHTML) el.innerHTML = options.innerHTML;
  if (options.textContent) el.textContent = options.textContent;
  if (options.children) {
    for (const child of options.children) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Chat UI Factory - creates chat UI elements
 * Stateless UI - elements are recreated on each item change
 * State data (messages, session) persists
 */
export class ChatUIFactory {
  private state: ChatUIState;
  private messageStates: Map<string, MessageRenderState>;
  private messageElements: Map<string, HTMLElement>;
  private containerElement: HTMLElement | null = null;
  private currentDoc: Document | null = null;

  constructor() {
    this.state = {
      currentSession: null,
      sessions: [],
      inputValue: "",
      attachments: [],
      isLoading: false,
      isSending: false,
    };
    this.messageStates = new Map();
    this.messageElements = new Map();

    // Initialize new session
    this.createNewSession();

    // Register callbacks only once
    this.registerCallbacks();
  }

  /**
   * Register API callbacks (only called once in constructor)
   */
  private registerCallbacks(): void {
    chatAPI.registerAgentMessageCallback(this.handleAgentMessage.bind(this));
    chatAPI.registerResponseCompleteCallback(
      this.handleResponseComplete.bind(this),
    );
    chatAPI.registerHistoryMessagesCallback(
      this.handleHistoryMessages.bind(this),
    );
  }

  getState(): ChatUIState {
    return this.state;
  }

  /**
   * Get current document
   */
  getCurrentDoc(): Document | null {
    return this.currentDoc;
  }

  /**
   * Set current document
   */
  setCurrentDoc(doc: Document): void {
    this.currentDoc = doc;
  }

  /**
   * Create the main chat panel UI
   * Called each time item changes - recreates all UI elements
   */
  createChatPanel(doc: Document): HTMLElement {
    // Update current doc reference
    this.currentDoc = doc;

    // Clear message states and elements for fresh render
    this.messageStates.clear();
    this.messageElements.clear();

    const container = createElement(doc, "div", {
      id: "chat-container",
      classList: ["chat-container"],
    });

    // Messages container
    const messagesContainer = createElement(doc, "div", {
      id: "chat-messages",
      classList: ["chat-messages"],
    });

    // Input area
    const inputArea = this.createInputArea(doc);

    container.appendChild(messagesContainer);
    container.appendChild(inputArea);

    this.containerElement = container;

    // Setup paste handler for file upload
    this.setupPasteHandler(doc);

    // Connect WebSocket (only once, uses global addon.api.websocket)
    this.connectWebSocket();

    return container;
  }

  /**
   * Create input area with file upload, reference, and send button
   */
  private createInputArea(doc: Document): HTMLElement {
    const inputArea = createElement(doc, "div", {
      id: "chat-input-area",
      classList: ["chat-input-area"],
    });

    // Attachments display
    const attachmentsDiv = createElement(doc, "div", {
      id: "chat-attachments",
      classList: ["chat-attachments"],
    });

    // Input row
    const inputRow = createElement(doc, "div", {
      classList: ["chat-input-row"],
    });

    // Upload button
    const uploadBtn = createElement(doc, "button", {
      id: "chat-upload-btn",
      classList: ["chat-upload-btn"],
      innerHTML: "&#128209;",
      properties: { title: "Upload file" },
    });
    uploadBtn.addEventListener("click", () => this.handleFileUploadClick(doc));

    // Reference button - reference current item's PDF
    const referenceBtn = createElement(doc, "button", {
      id: "chat-reference-btn",
      classList: ["chat-reference-btn"],
      innerHTML: "&#128196;",
      properties: { title: "Reference current PDF" },
    });
    referenceBtn.addEventListener("click", () =>
      this.handleReferenceClick(doc),
    );

    // Input textarea
    const textarea = createElement(doc, "textarea", {
      id: "chat-input",
      classList: ["chat-input"],
      properties: { placeholder: "Type your message...", rows: 1 },
    });
    textarea.addEventListener("keydown", (ev: KeyboardEvent) =>
      this.handleInputKeydown(ev),
    );
    textarea.addEventListener("input", () => this.handleInputChange(doc));

    // Send button
    const sendBtn = createElement(doc, "button", {
      id: "chat-send-btn",
      classList: ["chat-send-btn"],
      innerHTML: "&#10148;",
      properties: { title: "Send message" },
    });
    sendBtn.addEventListener("click", () => this.handleSendClick(doc));

    inputRow.appendChild(uploadBtn);
    inputRow.appendChild(referenceBtn);
    inputRow.appendChild(textarea);
    inputRow.appendChild(sendBtn);

    inputArea.appendChild(attachmentsDiv);
    inputArea.appendChild(inputRow);

    return inputArea;
  }

  /**
   * Create a message element
   */
  createMessageElement(
    doc: Document,
    message: UserMessage | AgentMessage,
    messageState: MessageRenderState,
  ): HTMLElement {
    const isUser = "user_query" in message;
    const messageType: UIMessageType = isUser ? "user" : message.message_type;

    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", `chat-message-${messageType}`],
    });
    messageContainer.dataset.messageId = messageState.id;

    if (isUser) {
      this.appendUserMessageContent(
        doc,
        messageContainer,
        message as UserMessage,
      );
    } else {
      this.appendAgentMessageContent(
        doc,
        messageContainer,
        message as AgentMessage,
        messageState,
      );
    }

    return messageContainer;
  }

  /**
   * Create agent message element (for streaming messages)
   */
  createAgentMessageElement(
    doc: Document,
    message: AgentMessage,
    messageState: MessageRenderState,
  ): HTMLElement {
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", `chat-message-${message.message_type}`],
    });
    messageContainer.dataset.messageId = messageState.id;

    this.appendAgentMessageContent(
      doc,
      messageContainer,
      message,
      messageState,
    );

    return messageContainer;
  }

  /**
   * Append user message content (plain text)
   */
  private appendUserMessageContent(
    doc: Document,
    container: HTMLElement,
    message: UserMessage,
  ): void {
    // Display attachments if any
    if (message.attachments) {
      for (const att of message.attachments) {
        const attEl = createElement(doc, "div", {
          classList: ["chat-attachment-item"],
          innerHTML: `&#128196; ${att.name} (${this.formatFileSize(att.size)})`,
        });
        container.appendChild(attEl);
      }
    }

    // Message content
    const contentEl = createElement(doc, "div", {
      classList: ["chat-message-content", "chat-user-content"],
    });
    contentEl.textContent = message.user_query;
    container.appendChild(contentEl);

    // Copy button - hidden until all responses complete, copies original content
    const copyBtn = this.createCopyButtonWithContent(doc, message.user_query);
    // copyBtn.style.display = "none";
    container.appendChild(copyBtn);
  }

  /**
   * Append agent message content (with markdown and collapsible blocks)
   */
  private appendAgentMessageContent(
    doc: Document,
    container: HTMLElement,
    message: AgentMessage,
    messageState: MessageRenderState,
  ): void {
    const isCollapsible =
      message.message_type === "thinking" || message.message_type === "tool";

    if (isCollapsible) {
      // Collapsible block
      const collapsible = createElement(doc, "div", {
        classList: ["chat-collapsible"],
      });
      collapsible.dataset.messageId = messageState.id;

      // Header
      const header = createElement(doc, "div", {
        classList: ["chat-collapsible-header"],
      });

      const toggleIcon = createElement(doc, "span", {
        classList: ["chat-collapsible-toggle"],
        innerHTML: messageState.isCollapsed ? "&#9654;" : "&#9660;",
      });

      const label = createElement(doc, "span", {
        classList: ["chat-collapsible-label"],
        textContent: message.message_type.toUpperCase(),
      });

      header.appendChild(toggleIcon);
      header.appendChild(label);

      header.addEventListener("click", () =>
        this.toggleCollapsible(doc, messageState.id),
      );

      // Content
      const content = createElement(doc, "div", {
        classList: ["chat-collapsible-content"],
      });
      content.textContent = message.content;
      if (messageState.isCollapsed) {
        content.classList.add("collapsed");
      }

      collapsible.appendChild(header);
      collapsible.appendChild(content);

      // Copy button - hidden until all responses complete, copies original content
      const copyBtn = this.createCopyButton(doc, message.message_id);
      copyBtn.style.display = "none";
      collapsible.appendChild(copyBtn);

      container.appendChild(collapsible);
    } else {
      // Content type - render as markdown
      const contentEl = createElement(doc, "div", {
        classList: ["chat-message-content", "chat-agent-content"],
        innerHTML: renderMarkdown(message.content),
      });
      container.appendChild(contentEl);

      // Copy button - hidden until all responses complete, copies original content
      const copyBtn = this.createCopyButton(doc, message.message_id);
      copyBtn.style.display = "none";
      container.appendChild(copyBtn);
    }
  }

  /**
   * Create copy button with direct content (for user messages)
   */
  private createCopyButtonWithContent(
    doc: Document,
    content: string,
  ): HTMLElement {
    const btn = createElement(doc, "button", {
      classList: ["chat-copy-btn"],
      innerHTML: "&#128203; Copy",
      properties: { title: "Copy to clipboard" },
    });
    btn.addEventListener("click", () => {
      this.copyToClipboard(content);
    });
    return btn;
  }

  /**
   * Create copy button - gets original content from session by message_id (for agent messages)
   */
  private createCopyButton(doc: Document, messageId: string): HTMLElement {
    const btn = createElement(doc, "button", {
      classList: ["chat-copy-btn"],
      innerHTML: "&#128203; Copy",
      properties: { title: "Copy to clipboard" },
    });
    btn.addEventListener("click", () => {
      const content = this.getOriginalContent(messageId);
      this.copyToClipboard(content);
    });
    return btn;
  }

  /**
   * Get original content from session by message_id (for agent messages)
   */
  private getOriginalContent(messageId: string): string {
    if (this.state.currentSession) {
      const msg = this.state.currentSession.messages.find(
        (m) => m.id === messageId,
      );
      if (msg) {
        return msg.content;
      }
    }
    return "";
  }

  /**
   * Toggle collapsible block
   */
  private toggleCollapsible(doc: Document, messageId: string): void {
    const state = this.messageStates.get(messageId);
    if (!state) return;

    state.isCollapsed = !state.isCollapsed;
    this.updateCollapsibleUI(doc, messageId, state.isCollapsed);
  }

  /**
   * Create copy button for thinking message - gets content dynamically from storedMsg
   */
  private createCopyButtonForThinking(
    doc: Document,
    messageId: string,
  ): HTMLElement {
    const btn = createElement(doc, "button", {
      classList: ["chat-copy-btn"],
      innerHTML: "&#128203; Copy",
      properties: { title: "Copy to clipboard" },
    });
    btn.addEventListener("click", () => {
      // Get reasoning_content from storedMsg dynamically
      const storedMsg = this.state.currentSession?.messages.find(
        (m) => m.id === messageId,
      );
      const content = storedMsg?.reasoning_content || "";
      this.copyToClipboard(content);
    });
    return btn;
  }

  /**
   * Create copy button for tool message - gets content dynamically from storedMsg
   */
  private createCopyButtonForTool(
    doc: Document,
    messageId: string,
  ): HTMLElement {
    const btn = createElement(doc, "button", {
      classList: ["chat-copy-btn"],
      innerHTML: "&#128203; Copy",
      properties: { title: "Copy to clipboard" },
    });
    btn.addEventListener("click", () => {
      // Get content from storedMsg dynamically
      const storedMsg = this.state.currentSession?.messages.find(
        (m) => m.id === messageId,
      );
      const content = storedMsg?.content || "";
      this.copyToClipboard(content);
    });
    return btn;
  }

  /**
   * Update collapsible UI state
   */
  private updateCollapsibleUI(
    doc: Document,
    messageId: string,
    isCollapsed: boolean,
  ): void {
    const messageEl = doc.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;

    const toggleIcon = messageEl.querySelector(".chat-collapsible-toggle");
    const contentEl = messageEl.querySelector(".chat-collapsible-content");

    if (toggleIcon) {
      toggleIcon.innerHTML = isCollapsed ? "&#9654;" : "&#9660;";
    }
    if (contentEl) {
      contentEl.classList.toggle("collapsed", isCollapsed);
    }
  }

  /**
   * Copy content to clipboard
   */
  private copyToClipboard(content: string): void {
    try {
      Zotero.Utilities.Internal.copyTextToClipboard(content);
      ztoolkit.log("Copied to clipboard");
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "✅ Copied Successfully!",
          type: "success",
          progress: 100,
        })
        .show(2000);
    } catch (e) {
      ztoolkit.log("Failed to copy to clipboard", e);
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ Copied Failed!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
    }
  }

  /**
   * Handle input keydown
   */
  private handleInputKeydown(ev: KeyboardEvent): void {
    const textarea = ev.target as HTMLTextAreaElement;

    if (ev.key === "Enter") {
      if (ev.shiftKey) {
        // Shift+Enter - allow newline (default behavior)
        return;
      } else {
        // Enter only - send message
        ev.preventDefault();
        const doc = textarea.ownerDocument;
        if (doc) {
          this.sendMessage(doc);
        }
      }
    }
  }

  /**
   * Handle input change - auto resize textarea
   */
  private handleInputChange(doc: Document): void {
    const textarea = doc.getElementById("chat-input") as HTMLTextAreaElement;
    if (!textarea) return;

    this.state.inputValue = textarea.value;

    // Auto resize
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  }

  /**
   * Handle send button click
   */
  private handleSendClick(doc: Document): void {
    this.sendMessage(doc);
  }

  /**
   * Validate input and send message
   */
  private sendMessage(doc: Document): void {
    const textarea = doc.getElementById("chat-input") as HTMLTextAreaElement;
    if (!textarea) return;

    const query = textarea.value.trim();

    // Validate input
    if (!this.validateInput(query)) {
      return;
    }

    // Prevent sending while already sending
    if (this.state.isSending) {
      return;
    }

    // Create user message
    const userMessage: UserMessage = {
      session_id: getOrCreateSessionId(),
      user_query: query,
      attachments:
        this.state.attachments.length > 0 ? this.state.attachments : undefined,
    };

    // Clear input and attachments
    textarea.value = "";
    textarea.style.height = "auto";
    this.state.inputValue = "";
    this.state.attachments = [];
    this.updateAttachmentsDisplay(doc);

    // Create message state and element
    const messageState: MessageRenderState = {
      id: generateId(),
      isCollapsed: false,
      isStreaming: false,
    };
    this.messageStates.set(messageState.id, messageState);

    // Add to session as StoredMessage
    if (this.state.currentSession) {
      this.state.currentSession.messages.push({
        id: messageState.id,
        role: "user",
        content: query,
      });
    }

    // Render user message
    this.appendUserMessage(doc, userMessage, messageState);

    // Set sending state
    this.state.isSending = true;
    this.updateSendButtonState(doc, true);

    // Send to agent via WebSocket
    this.sendWebSocketMessage(userMessage);
  }

  /**
   * Send message via WebSocket
   */
  private sendWebSocketMessage(userMessage: UserMessage): void {
    if (
      !addon.api.websocket ||
      addon.api.websocket.readyState !== WebSocket.OPEN
    ) {
      ztoolkit.log("WebSocket not connected, cannot send message");
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ WebSocket not connected!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      // Reset sending state
      this.state.isSending = false;
      const doc = this.currentDoc;
      if (doc) {
        this.updateSendButtonState(doc, false);
      }
      return;
    }

    const request: WSRequest = {
      type: "chat",
      session_id: userMessage.session_id,
      message: userMessage.user_query,
    };
    addon.api.websocket.send(JSON.stringify(request));
    ztoolkit.log("Sent chat request via WebSocket:", request);
  }

  /**
   * Validate input before sending
   */
  private validateInput(query: string): boolean {
    if (!query || query.trim() === "") {
      ztoolkit.log("Empty query, not sending");
      return false;
    }
    return true;
  }

  /**
   * Handle agent message callback (streaming)
   */
  private handleAgentMessage(message: AgentMessage): void {
    // Get the container document
    const doc = this.currentDoc;
    if (!doc) {
      ztoolkit.log("No document available for rendering agent message");
      return;
    }

    const messageId = message.message_id;
    const existingElement = this.messageElements.get(messageId);

    if (existingElement) {
      // Update existing message
      this.updateAgentMessage(doc, message, existingElement);
    } else {
      // Create new message
      const messageState: MessageRenderState = {
        id: messageId,
        isCollapsed: false,
        isStreaming: !message.is_complete,
      };
      this.messageStates.set(messageId, messageState);

      // Add to session
      if (
        this.state.currentSession &&
        message.session_id === this.state.currentSession.session_id
      ) {
        // Store as StoredMessage - use "assistant" role for thinking/content, "tool" for tool
        const role = message.message_type === "tool" ? "tool" : "assistant";
        this.state.currentSession.messages.push({
          id: messageId,
          role,
          content: message.content,
        });
      }

      // Render agent message
      this.appendAgentMessage(doc, message, messageState);
    }
  }

  /**
   * Handle response complete callback
   */
  private handleResponseComplete(success: boolean, error?: string): void {
    const doc = this.currentDoc;

    // Reset sending state and enable send button
    this.state.isSending = false;
    if (doc) {
      this.updateSendButtonState(doc, false);
    }

    if (success) {
      // Show all copy buttons
      if (doc) {
        const copyButtons = doc.querySelectorAll(".chat-copy-btn");
        for (const btn of copyButtons) {
          (btn as HTMLElement).style.display = "block";
        }
      }

      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "✅ Response completed!",
          type: "success",
          progress: 100,
        })
        .show(2000);
    } else {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: `❌ Response failed: ${error || "Unknown error"}`,
          type: "fail",
          progress: 100,
        })
        .show(3000);
    }
  }

  /**
   * Handle history messages callback - load history into session
   */
  private handleHistoryMessages(
    sessionId: string,
    messages: BackendMessage[],
  ): void {
    const doc = this.currentDoc;
    if (!doc) {
      ztoolkit.log("No document available for rendering history messages");
      return;
    }

    // Find or create session
    let session = this.state.sessions.find((s) => s.session_id === sessionId);
    if (!session) {
      session = {
        session_id: sessionId,
        messages: [],
        created_at: new Date(),
      };
      this.state.sessions.push(session);
    }

    // Set as current session
    this.state.currentSession = session;

    // Clear existing messages in session
    session.messages = [];
    this.messageStates.clear();
    this.messageElements.clear();

    // Clear messages container
    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }

    // Process each history message based on role
    for (const msg of messages) {
      // Store message
      session.messages.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        reasoning_content: msg.reasoning_content,
      });

      // Render based on role
      if (msg.role === "user") {
        this.renderUserMessageFromBackend(doc, {
          id: msg.id,
          session_id: sessionId,
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant") {
        // Render thinking if reasoning_content exists
        if (msg.reasoning_content) {
          this.renderThinkingMessage(doc, msg.id, msg.reasoning_content);
        }
        // Render content
        if (msg.content) {
          this.renderContentMessage(doc, msg.id, msg.content);
        }
      } else if (msg.role === "tool") {
        this.renderToolMessage(doc, msg.id, msg.content);
      }
    }

    // Show all copy buttons for history messages
    const copyButtons = doc.querySelectorAll(".chat-copy-btn");
    for (const btn of copyButtons) {
      (btn as HTMLElement).style.display = "block";
    }

    ztoolkit.log("History messages loaded", sessionId, messages.length);
  }

  /**
   * Update existing agent message content (streaming)
   */
  private updateAgentMessage(
    doc: Document,
    message: AgentMessage,
    element: HTMLElement,
  ): void {
    // Update stored message in session
    if (this.state.currentSession) {
      const storedMsg = this.state.currentSession.messages.find(
        (m) => m.id === message.message_id,
      );
      if (storedMsg) {
        storedMsg.content = message.content;
      }
    }

    // Update UI element
    const isCollapsible =
      message.message_type === "thinking" || message.message_type === "tool";

    if (isCollapsible) {
      const contentEl = element.querySelector(".chat-collapsible-content");
      if (contentEl) {
        contentEl.textContent = message.content;
      }
    } else {
      const contentEl = element.querySelector(".chat-agent-content");
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(message.content);
        // contentEl.textContent = renderMarkdown(message.content);
      }
    }

    // Scroll to bottom
    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Append new agent message to messages container
   */
  private appendAgentMessage(
    doc: Document,
    message: AgentMessage,
    messageState: MessageRenderState,
  ): void {
    const messagesContainer = doc.getElementById("chat-messages");
    if (!messagesContainer) return;

    const messageEl = this.createAgentMessageElement(
      doc,
      message,
      messageState,
    );
    messageEl.setAttribute("data-message-id", message.message_id);
    this.messageElements.set(message.message_id, messageEl);
    messagesContainer.appendChild(messageEl);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Append user message to messages container
   */
  private appendUserMessage(
    doc: Document,
    message: UserMessage,
    messageState: MessageRenderState,
  ): void {
    const messagesContainer = doc.getElementById("chat-messages");
    if (!messagesContainer) return;

    const messageEl = this.createMessageElement(doc, message, messageState);
    messagesContainer.appendChild(messageEl);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Update send button state (disabled while sending)
   */
  private updateSendButtonState(doc: Document, isSending: boolean): void {
    const sendBtn = doc.getElementById("chat-send-btn");
    if (sendBtn) {
      sendBtn.classList.toggle("disabled", isSending);
    }
  }

  /**
   * Handle file upload button click
   */
  private handleFileUploadClick(doc: Document): void {
    // Create file input
    const fileInput = doc.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = "*/*";

    fileInput.onchange = async (ev: Event) => {
      const files = (ev.target as HTMLInputElement).files;
      if (files) {
        for (const file of files) {
          // Get file path from file object
          const filePath = (file as any).path || (file as any).mozFullPath;
          if (filePath) {
            this.addFileAttachment(filePath, doc);
          } else {
            // Fallback: show error if path not available
            new ztoolkit.ProgressWindow(addon.data.config.addonName)
              .createLine({
                text: `❌ Could not get path for ${file.name}`,
                type: "fail",
                progress: 100,
              })
              .show(2000);
          }
        }
      }
    };

    fileInput.click();
  }

  /**
   * Add file attachment by absolute path
   * @param filePath - Absolute file path
   * @param doc - Document for UI update
   */
  private addFileAttachment(filePath: string, doc: Document): void {
    // Get file name from path
    const fileName = filePath.split(/[/\\]/).pop() || "Unknown";

    // Get file size
    let fileSize = 0;
    try {
      const file = Zotero.File.pathToFile(filePath);
      fileSize = file.exists() ? file.fileSize : 0;
    } catch (e) {
      ztoolkit.log("Could not get file size", e);
    }

    // Determine file type
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "doc" || ext === "docx"
          ? "application/msword"
          : ext === "txt"
            ? "text/plain"
            : "application/octet-stream";

    // Add as attachment
    const fileAttachment: FileAttachment = {
      name: fileName,
      type: mimeType,
      size: fileSize,
      path: filePath,
    };

    this.state.attachments.push(fileAttachment);
    this.updateAttachmentsDisplay(doc);

    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: `✅ File added: ${fileName}`,
        type: "success",
        progress: 100,
      })
      .show(2000);
  }

  /**
   * Handle reference button click - get current item's PDF path
   */
  private handleReferenceClick(doc: Document): void {
    // Get current selected item using Zotero's active window
    const win = Zotero.getMainWindow();
    if (!win) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ Zotero window not available!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      return;
    }

    const items = win.ZoteroPane?.getSelectedItems();
    const item = items?.[0];

    if (!item) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ No item selected!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      return;
    }

    // Check if item has attachments
    const attachments = item.getAttachments();
    if (!attachments || attachments.length === 0) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ No PDF attachment found!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      return;
    }

    // Get the first PDF attachment
    const attachmentId = attachments[0];
    const attachment = Zotero.Items.get(attachmentId);

    if (!attachment || !attachment.isPDFAttachment()) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ Selected attachment is not a PDF!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      return;
    }

    // Get file path
    const filePath = attachment.getFilePath();
    if (!filePath) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ Could not get file path!",
          type: "fail",
          progress: 100,
        })
        .show(2000);
      return;
    }

    // Add file attachment
    this.addFileAttachment(filePath, doc);
  }

  /**
   * Setup paste handler for file paste detection
   */
  private setupPasteHandler(doc: Document): void {
    const textarea = doc.getElementById("chat-input");
    if (!textarea) return;

    textarea.addEventListener("paste", (ev: Event) => {
      const pasteEvent = ev as ClipboardEvent;
      const items = pasteEvent.clipboardData?.items;

      if (!items) return;

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            // Get file path from file object
            const filePath = (file as any).path || (file as any).mozFullPath;
            if (filePath) {
              this.addFileAttachment(filePath, doc);
            }
          }
        }
      }
    });
  }

  /**
   * Update attachments display
   */
  private updateAttachmentsDisplay(doc: Document): void {
    const container = doc.getElementById("chat-attachments");
    if (!container) return;

    container.innerHTML = "";

    for (const att of this.state.attachments) {
      const attEl = createElement(doc, "div", {
        classList: ["chat-attachment-item"],
      });

      // Display differently for path-based vs data-based attachments
      const displayInfo = att.path
        ? `&#128196; ${att.name} [PDF]`
        : `&#128196; ${att.name} (${this.formatFileSize(att.size)})`;

      const nameEl = createElement(doc, "span");
      nameEl.innerHTML = displayInfo;

      const removeBtn = createElement(doc, "button", {
        classList: ["chat-attachment-remove"],
        innerHTML: "&#10005;",
        properties: { title: "Remove" },
      });
      removeBtn.addEventListener("click", () =>
        this.removeAttachment(doc, att),
      );

      attEl.appendChild(nameEl);
      attEl.appendChild(removeBtn);
      container.appendChild(attEl);
    }
  }

  /**
   * Remove attachment
   */
  private removeAttachment(doc: Document, attachment: FileAttachment): void {
    const index = this.state.attachments.indexOf(attachment);
    if (index >= 0) {
      this.state.attachments.splice(index, 1);
      this.updateAttachmentsDisplay(doc);
    }
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /**
   * Connect to WebSocket at localhost:8005/ws (auto-connect)
   */
  private connectWebSocket(): void {
    const wsUrl = "ws://localhost:8005/ws";

    if (addon.api.websocket) {
      ztoolkit.log("WebSocket already connected");
      return;
    }

    try {
      addon.api.websocket = new WebSocket(wsUrl);

      addon.api.websocket.addEventListener("open", () => {
        ztoolkit.log("WebSocket connected to", wsUrl);
      });

      addon.api.websocket.addEventListener(
        "message",
        async (event: MessageEvent) => {
          ztoolkit.log("WebSocket message received:", event.data);

          // Handle Blob data (decode as UTF-8)
          let data: string;
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            data = text;
          } else {
            data = event.data as string;
          }

          // Parse JSON message
          try {
            const parsed = JSON.parse(data);
            console.log(parsed);

            // Check if it's a response with type field or a chat message
            if (parsed.type) {
              // It's a WSResponse
              this.handleWebSocketResponse(parsed as WSResponse);
            } else {
              // It's a chat message (WSChatMessage)
              this.handleChatMessage(parsed as WSChatMessage);
            }
          } catch {
            // Not JSON, treat as plain text chat response
            const message: AgentMessage = {
              message_id: generateId(),
              session_id: this.state.currentSession?.session_id || "",
              message_type: "content",
              content: data,
              is_complete: true,
            };
            this.handleAgentMessage(message);
          }
        },
      );

      addon.api.websocket.addEventListener("error", (error: Event) => {
        ztoolkit.log("WebSocket error:", error);
      });

      addon.api.websocket.addEventListener("close", () => {
        ztoolkit.log("WebSocket closed");
        addon.api.websocket = null;
        // Try to reconnect after 5 seconds
        setTimeout(() => {
          this.connectWebSocket();
        }, 5000);
      });
    } catch (error) {
      ztoolkit.log("Failed to connect WebSocket:", error);
    }
  }

  /**
   * Handle WebSocket response (get_sessions_response, get_history_response)
   */
  private handleWebSocketResponse(response: WSResponse): void {
    switch (response.type) {
      case "get_sessions_response":
        // Sessions list response
        if (response.session_ids) {
          this.handleSessionsResponse(response.session_ids);
        }
        break;

      case "get_history_response":
        // History messages response
        if (response.messages && response.session_id) {
          this.handleHistoryMessages(response.session_id, response.messages);
        }
        break;

      default:
        ztoolkit.log("Unknown response type:", response.type);
    }
  }

  /**
   * Handle chat message from WebSocket (supports streaming - incremental append)
   * role: user, assistant, tool
   * assistant with reasoning_content -> thinking (collapsed)
   * assistant with content -> content (not collapsed)
   * tool -> tool (collapsed)
   */
  private handleChatMessage(msg: WSChatMessage): void {
    const doc = this.currentDoc;
    if (!doc) {
      ztoolkit.log("No document available");
      return;
    }

    // Debug: log received message structure
    ztoolkit.log(
      "handleChatMessage received:",
      "id:",
      msg.id,
      "role:",
      msg.role,
      "content:",
      msg.content ? `"${msg.content.substring(0, 50)}..."` : "null/empty",
      "reasoning_content:",
      msg.reasoning_content
        ? `"${msg.reasoning_content.substring(0, 50)}..."`
        : "null/empty",
    );

    // Store/update message (incremental append for streaming)
    if (
      this.state.currentSession &&
      msg.session_id === this.state.currentSession.session_id
    ) {
      // Find existing message by id
      const existingMsg = this.state.currentSession.messages.find(
        (m) => m.id === msg.id,
      );
      if (existingMsg) {
        // Incremental append: append new content to existing
        if (msg.content) {
          existingMsg.content += msg.content;
        }
        if (msg.reasoning_content) {
          existingMsg.reasoning_content =
            (existingMsg.reasoning_content || "") + msg.reasoning_content;
        }
      } else {
        // New message
        const storedMsg: StoredMessage = {
          id: msg.id,
          role: msg.role,
          content: msg.content || "",
          reasoning_content: msg.reasoning_content || "",
        };
        this.state.currentSession.messages.push(storedMsg);
      }
    }

    // Get the stored message for rendering (contains accumulated content)
    const storedMsg = this.state.currentSession?.messages.find(
      (m) => m.id === msg.id,
    );

    // Render based on role (re-render with accumulated content)
    if (msg.role === "user") {
      // User message - check if already exists (user messages are usually complete)
      const existingEl = doc.querySelector(`[data-message-id="${msg.id}"]`);
      if (!existingEl) {
        this.renderUserMessageFromBackend(doc, msg);
      }
    } else if (msg.role === "assistant") {
      // Assistant message - handle thinking and content separately

      // Render thinking if reasoning_content exists and has content
      if (storedMsg?.reasoning_content?.trim()) {
        const thinkingId = `${msg.id}-thinking`;
        const existingThinkingEl = doc.querySelector(
          `[data-message-id="${thinkingId}"]`,
        );
        if (existingThinkingEl) {
          // Re-render with accumulated content
          const contentEl = existingThinkingEl.querySelector(
            ".chat-collapsible-content",
          );
          if (contentEl) {
            contentEl.textContent = storedMsg.reasoning_content;
          }
        } else {
          // Create new thinking message with accumulated content
          this.renderThinkingMessage(doc, msg.id, storedMsg.reasoning_content);
        }
      }

      // Render content if exists and has content
      if (storedMsg?.content?.trim()) {
        const existingContentEl = doc.querySelector(
          `[data-message-id="${msg.id}"].chat-message-content`,
        );
        if (existingContentEl) {
          // Re-render with accumulated content
          const contentEl = existingContentEl.querySelector(
            ".chat-agent-content",
          );
          if (contentEl) {
            // contentEl.innerHTML = renderMarkdown(storedMsg.content);
            contentEl.textContent = storedMsg.content;
          }
        } else {
          // Create new content message with accumulated content
          this.renderContentMessage(doc, msg.id, storedMsg.content);
        }
      }

      // Scroll to bottom
      const messagesContainer = doc.getElementById("chat-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } else if (msg.role === "tool") {
      // Tool message - re-render with accumulated content
      const existingEl = doc.querySelector(`[data-message-id="${msg.id}"]`);
      if (existingEl && storedMsg?.content) {
        // Re-render with accumulated content
        const contentEl = existingEl.querySelector(".chat-collapsible-content");
        if (contentEl) {
          contentEl.textContent = storedMsg.content;
        }
      } else if (!existingEl && storedMsg?.content) {
        // Create new tool message with accumulated content
        this.renderToolMessage(doc, msg.id, storedMsg.content);
      }

      // Scroll to bottom
      const messagesContainer = doc.getElementById("chat-messages");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // Handle finish signal - response complete
    if (msg.finish === true) {
      this.handleResponseComplete(true);
    }
  }

  /**
   * Render user message from backend
   */
  private renderUserMessageFromBackend(
    doc: Document,
    msg: WSChatMessage,
  ): void {
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", "chat-message-user"],
    });
    messageContainer.dataset.messageId = msg.id;

    const contentEl = createElement(doc, "div", {
      classList: ["chat-message-content", "chat-user-content"],
    });
    contentEl.textContent = msg.content;
    messageContainer.appendChild(contentEl);

    // Copy button
    const copyBtn = this.createCopyButtonWithContent(doc, msg.content);
    messageContainer.appendChild(copyBtn);

    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(messageContainer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Render thinking message (assistant's reasoning_content) - collapsed
   */
  private renderThinkingMessage(
    doc: Document,
    messageId: string,
    reasoningContent: string,
  ): void {
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", "chat-message-thinking"],
    });
    const thinkingId = `${messageId}-thinking`;
    messageContainer.dataset.messageId = thinkingId;

    // Collapsible block
    const collapsible = createElement(doc, "div", {
      classList: ["chat-collapsible"],
    });
    collapsible.dataset.messageId = thinkingId;

    const header = createElement(doc, "div", {
      classList: ["chat-collapsible-header"],
    });

    const toggleIcon = createElement(doc, "span", {
      classList: ["chat-collapsible-toggle"],
      innerHTML: "&#9660;",
    });

    const label = createElement(doc, "span", {
      classList: ["chat-collapsible-label"],
      textContent: "THINKING",
    });

    header.appendChild(toggleIcon);
    header.appendChild(label);

    const messageState: MessageRenderState = {
      id: thinkingId,
      isCollapsed: false,
      isStreaming: false,
    };
    this.messageStates.set(thinkingId, messageState);

    header.addEventListener("click", () =>
      this.toggleCollapsible(doc, thinkingId),
    );

    const content = createElement(doc, "div", {
      classList: ["chat-collapsible-content"],
    });
    content.textContent = reasoningContent;

    collapsible.appendChild(header);
    collapsible.appendChild(content);

    // Copy button - dynamically gets content from storedMsg
    const copyBtn = this.createCopyButtonForThinking(doc, messageId);
    collapsible.appendChild(copyBtn);

    messageContainer.appendChild(collapsible);

    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(messageContainer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Render content message (assistant's content) - not collapsed
   */
  private renderContentMessage(
    doc: Document,
    messageId: string,
    content: string,
  ): void {
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", "chat-message-content"],
    });
    messageContainer.dataset.messageId = messageId;

    const contentEl = createElement(doc, "div", {
      classList: ["chat-message-content", "chat-agent-content"],
      // innerHTML: renderMarkdown(content),
    });
    contentEl.textContent = content;
    messageContainer.appendChild(contentEl);

    // Copy button
    const copyBtn = this.createCopyButtonWithContent(doc, content);
    messageContainer.appendChild(copyBtn);

    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(messageContainer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Render tool message - collapsed
   */
  private renderToolMessage(
    doc: Document,
    messageId: string,
    content: string,
  ): void {
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", "chat-message-tool"],
    });
    messageContainer.dataset.messageId = messageId;

    // Collapsible block
    const collapsible = createElement(doc, "div", {
      classList: ["chat-collapsible"],
    });
    collapsible.dataset.messageId = messageId;

    const header = createElement(doc, "div", {
      classList: ["chat-collapsible-header"],
    });

    const toggleIcon = createElement(doc, "span", {
      classList: ["chat-collapsible-toggle"],
      innerHTML: "&#9660;",
    });

    const label = createElement(doc, "span", {
      classList: ["chat-collapsible-label"],
      textContent: "TOOL",
    });

    header.appendChild(toggleIcon);
    header.appendChild(label);

    const messageState: MessageRenderState = {
      id: messageId,
      isCollapsed: false,
      isStreaming: false,
    };
    this.messageStates.set(messageId, messageState);

    header.addEventListener("click", () =>
      this.toggleCollapsible(doc, messageId),
    );

    const contentEl = createElement(doc, "div", {
      classList: ["chat-collapsible-content"],
    });
    contentEl.textContent = content;

    collapsible.appendChild(header);
    collapsible.appendChild(contentEl);

    // Copy button - dynamically gets content from storedMsg
    const copyBtn = this.createCopyButtonForTool(doc, messageId);
    collapsible.appendChild(copyBtn);

    messageContainer.appendChild(collapsible);

    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(messageContainer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Request history messages from WebSocket
   */
  requestHistory(sessionId: string): void {
    if (
      !addon.api.websocket ||
      addon.api.websocket.readyState !== WebSocket.OPEN
    ) {
      ztoolkit.log("WebSocket not connected, cannot request history");
      return;
    }

    const request: WSRequest = {
      type: "get_history",
      session_id: sessionId,
    };
    addon.api.websocket.send(JSON.stringify(request));
    ztoolkit.log("Requested history for session:", sessionId);
  }

  /**
   * Request sessions list from WebSocket
   */
  requestSessions(): void {
    if (
      !addon.api.websocket ||
      addon.api.websocket.readyState !== WebSocket.OPEN
    ) {
      ztoolkit.log("WebSocket not connected, cannot request sessions");
      return;
    }

    const request: WSRequest = {
      type: "get_sessions",
    };
    addon.api.websocket.send(JSON.stringify(request));
    ztoolkit.log("Requested sessions list");
  }

  /**
   * Handle sessions list response from WebSocket
   */
  private handleSessionsResponse(sessionIds: string[]): void {
    ztoolkit.log("Received sessions list:", sessionIds);
    this.state.sessions = sessionIds.map((sessionId) => ({
      session_id: sessionId,
      messages: [],
      created_at: new Date(),
    }));
  }

  /**
   * Create new chat session - uses session_id from prefs
   */
  private createNewSession(): void {
    const sessionId = getOrCreateSessionId();
    const session: ChatSession = {
      session_id: sessionId,
      messages: [],
      created_at: new Date(),
    };
    this.state.currentSession = session;
    this.state.sessions.push(session);
  }

  /**
   * Clear current session messages
   */
  clearSession(doc: Document): void {
    if (this.state.currentSession) {
      this.state.currentSession.messages = [];
    }
    this.messageStates.clear();

    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }

    // Create new session
    this.createNewSession();
  }
}
