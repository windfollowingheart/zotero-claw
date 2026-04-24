/**
 * ZoteroClaw Chat - UI Components
 *
 * Factory functions for creating chat UI elements using native DOM API
 */

import type {
  AgentMessage,
  ChatMessage,
  ChatSession,
  ChatUIState,
  FileAttachment,
  HistoryAgentMessage,
  HistoryMessage,
  MessageRenderState,
  MessageType,
  SessionInfo,
  StoredAgentMessage,
  UserMessage,
  WSRequest,
  WSResponse,
} from "./types";
import { chatAPI } from "./api";
import { renderMarkdown, renderPlainText } from "./renderer";

/**
 * Generate unique ID using UUID (first 8 characters)
 */
function generateId(): string {
  const uuid = crypto.randomUUID();
  return uuid.substring(0, 8);
}

/**
 * Generate session ID using UUID (first 8 characters)
 */
function generateSessionId(): string {
  const uuid = crypto.randomUUID();
  return `session-${uuid.substring(0, 8)}`;
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
 */
export class ChatUIFactory {
  private state: ChatUIState;
  private messageStates: Map<string, MessageRenderState>;
  private messageElements: Map<string, HTMLElement>;
  private containerElement: HTMLElement | null = null;
  private websocket: WebSocket | null = null;

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

    // Register agent message callback
    chatAPI.registerAgentMessageCallback(this.handleAgentMessage.bind(this));

    // Register response complete callback
    chatAPI.registerResponseCompleteCallback(
      this.handleResponseComplete.bind(this),
    );

    // Register history messages callback
    chatAPI.registerHistoryMessagesCallback(
      this.handleHistoryMessages.bind(this),
    );
  }

  /**
   * Create the main chat panel UI
   */
  createChatPanel(doc: Document): HTMLElement {
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

    // Connect WebSocket
    this.connectWebSocket();

    setTimeout(() => {
      this.requestSessions();
      this.requestHistory("123");
    }, 1000);

    return container;
  }

  /**
   * Create input area with file upload and send button
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
      innerHTML: "&#128206;",
      properties: { title: "Upload file" },
    });
    uploadBtn.addEventListener("click", () => this.handleFileUploadClick(doc));

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
    message: ChatMessage,
    messageState: MessageRenderState,
  ): HTMLElement {
    const isUser = "user_query" in message;
    const messageType: MessageType = isUser ? "user" : message.message_type;

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
      innerHTML: renderPlainText(message.user_query),
    });
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
        innerHTML: renderPlainText(message.content),
      });
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
        (m) => "message_id" in m && m.message_id === messageId,
      );
      if (msg && "content" in msg) {
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
    console.log("doc@@");

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
      session_id: this.state.currentSession?.session_id || generateSessionId(),
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

    // Add to session
    if (this.state.currentSession) {
      this.state.currentSession.messages.push(userMessage);
    }

    // Create message state and element
    const messageState: MessageRenderState = {
      id: generateId(),
      isCollapsed: false,
      isStreaming: false,
    };
    this.messageStates.set(messageState.id, messageState);

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
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
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
      const doc = this.containerElement?.ownerDocument;
      if (doc) {
        this.updateSendButtonState(doc, false);
      }
      return;
    }

    const request: WSRequest = {
      type: "chat",
      session_id: userMessage.session_id,
      user_query: userMessage.user_query,
      attachments: userMessage.attachments,
    };
    this.websocket.send(JSON.stringify(request));
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
    const doc = this.containerElement?.ownerDocument;
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
        this.state.currentSession.messages.push({
          message_id: messageId,
          session_id: message.session_id,
          message_type: message.message_type,
          content: message.content,
          is_complete: message.is_complete,
        });
      }

      // Render agent message
      this.appendAgentMessage(doc, message, messageState);
    }

    // If message is complete and is content type, reset sending state
    if (message.is_complete && message.message_type === "content") {
      this.state.isSending = false;
      this.updateSendButtonState(doc, false);
    }
  }

  /**
   * Handle response complete callback
   */
  private handleResponseComplete(success: boolean, error?: string): void {
    const doc = this.containerElement?.ownerDocument;

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
    messages: HistoryMessage[],
  ): void {
    const doc = this.containerElement?.ownerDocument;
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

    // Process each history message
    for (const historyMsg of messages) {
      if (historyMsg.message_type === "user") {
        // User message
        const userMessage: UserMessage = {
          session_id: sessionId,
          user_query: historyMsg.content,
        };
        session.messages.push(userMessage);

        const messageState: MessageRenderState = {
          id: generateId(),
          isCollapsed: false,
          isStreaming: false,
        };
        this.messageStates.set(messageState.id, messageState);
        this.appendUserMessage(doc, userMessage, messageState);
      } else {
        // Agent message with potential submessages
        this.renderHistoryAgentMessage(doc, sessionId, historyMsg, session);
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
   * Render history agent message with submessages
   */
  private renderHistoryAgentMessage(
    doc: Document,
    sessionId: string,
    historyMsg: HistoryAgentMessage,
    session: ChatSession,
  ): void {
    const message_id = generateId();

    // Create message container
    const messageContainer = createElement(doc, "div", {
      classList: ["chat-message", `chat-message-${historyMsg.message_type}`],
    });
    messageContainer.dataset.messageId = message_id;

    // Render submessages first (thinking/tool collapsible blocks)
    if (historyMsg.submessages && historyMsg.submessages.length > 0) {
      for (const subMsg of historyMsg.submessages) {
        const submessage_id = generateId();
        const subMessageState: MessageRenderState = {
          id: submessage_id,
          isCollapsed: false,
          isStreaming: false,
        };
        this.messageStates.set(submessage_id, subMessageState);

        // Create collapsible block for thinking/tool
        const collapsible = createElement(doc, "div", {
          classList: ["chat-collapsible"],
        });
        collapsible.dataset.messageId = submessage_id;

        const header = createElement(doc, "div", {
          classList: ["chat-collapsible-header"],
        });

        const toggleIcon = createElement(doc, "span", {
          classList: ["chat-collapsible-toggle"],
          innerHTML: "&#9660;",
        });

        const label = createElement(doc, "span", {
          classList: ["chat-collapsible-label"],
          textContent: subMsg.message_type.toUpperCase(),
        });

        header.appendChild(toggleIcon);
        header.appendChild(label);

        header.addEventListener("click", () =>
          this.toggleCollapsible(doc, submessage_id),
        );

        const content = createElement(doc, "div", {
          classList: ["chat-collapsible-content"],
          innerHTML: renderPlainText(subMsg.content),
        });

        collapsible.appendChild(header);
        collapsible.appendChild(content);

        // Copy button for submessage
        const copyBtn = this.createCopyButtonWithContent(doc, subMsg.content);
        collapsible.appendChild(copyBtn);

        messageContainer.appendChild(collapsible);
      }
    }

    // Render main content
    const contentEl = createElement(doc, "div", {
      classList: ["chat-message-content", "chat-agent-content"],
      innerHTML: renderMarkdown(historyMsg.content),
    });
    messageContainer.appendChild(contentEl);

    // Copy button for main content
    const copyBtn = this.createCopyButtonWithContent(doc, historyMsg.content);
    messageContainer.appendChild(copyBtn);

    // Store message
    const agentMessage: StoredAgentMessage = {
      message_id,
      session_id: sessionId,
      message_type: historyMsg.message_type,
      content: historyMsg.content,
      is_complete: true,
      submessages: historyMsg.submessages?.map((sub: HistoryAgentMessage) => ({
        message_id: generateId(),
        session_id: sessionId,
        message_type: sub.message_type,
        content: sub.content,
        is_complete: true,
      })),
    };
    session.messages.push(agentMessage);

    const messageState: MessageRenderState = {
      id: message_id,
      isCollapsed: false,
      isStreaming: false,
    };
    this.messageStates.set(message_id, messageState);
    this.messageElements.set(message_id, messageContainer);

    // Append to messages container
    const messagesContainer = doc.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.appendChild(messageContainer);
    }
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
        (m) => "message_id" in m && m.message_id === message.message_id,
      );
      if (storedMsg && "content" in storedMsg) {
        storedMsg.content = message.content;
        storedMsg.is_complete = message.is_complete;
      }
    }

    // Update UI element
    const isCollapsible =
      message.message_type === "thinking" || message.message_type === "tool";

    if (isCollapsible) {
      const contentEl = element.querySelector(".chat-collapsible-content");
      if (contentEl) {
        contentEl.innerHTML = renderPlainText(message.content);
      }
    } else {
      const contentEl = element.querySelector(".chat-agent-content");
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(message.content);
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
        await this.handleFiles(doc, files);
      }
    };

    fileInput.click();
  }

  /**
   * Setup paste handler for file paste detection
   */
  private setupPasteHandler(doc: Document): void {
    const textarea = doc.getElementById("chat-input");
    if (!textarea) return;

    textarea.addEventListener("paste", async (ev: Event) => {
      const pasteEvent = ev as ClipboardEvent;
      const items = pasteEvent.clipboardData?.items;

      if (!items) return;

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            await this.handleFiles(doc, [file]);
          }
        }
      }
    });
  }

  /**
   * Handle files from upload or paste
   */
  private async handleFiles(
    doc: Document,
    files: FileList | File[],
  ): Promise<void> {
    for (const file of files) {
      const attachment: FileAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
      };

      // Read file data
      try {
        attachment.data = await this.readFileAsArrayBuffer(file);
      } catch (e) {
        ztoolkit.log("Failed to read file", e);
      }

      this.state.attachments.push(attachment);
    }

    this.updateAttachmentsDisplay(doc);
  }

  /**
   * Read file as ArrayBuffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
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

      const nameEl = createElement(doc, "span", {
        innerHTML: `&#128196; ${att.name} (${this.formatFileSize(att.size)})`,
      });

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

    if (this.websocket) {
      ztoolkit.log("WebSocket already connected");
      return;
    }

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.addEventListener("open", () => {
        ztoolkit.log("WebSocket connected to", wsUrl);
      });

      this.websocket.addEventListener(
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
            const response: WSResponse = JSON.parse(data);
            console.log(response);

            this.handleWebSocketResponse(response);
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

      this.websocket.addEventListener("error", (error: Event) => {
        ztoolkit.log("WebSocket error:", error);
      });

      this.websocket.addEventListener("close", () => {
        ztoolkit.log("WebSocket closed");
        this.websocket = null;
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
   * Handle WebSocket response based on message type
   */
  private handleWebSocketResponse(response: WSResponse): void {
    switch (response.type) {
      case "chat_response":
        // Single chat response
        if (response.message_type && response.content) {
          const message: AgentMessage = {
            message_id: response.message_id || generateId(),
            session_id: response.session_id,
            message_type: response.message_type,
            content: response.content,
            is_complete: response.is_complete ?? true,
          };
          this.handleAgentMessage(message);
        }
        break;

      case "streaming":
        // Streaming message chunk
        if (response.message_type && response.content) {
          const message: AgentMessage = {
            message_id: response.message_id || generateId(),
            session_id: response.session_id,
            message_type: response.message_type,
            content: response.content,
            is_complete: false,
          };
          this.handleAgentMessage(message);
        }
        break;

      case "complete":
        // Message complete signal
        this.handleResponseComplete(true);
        break;

      case "history_response":
        // History messages response
        if (response.messages && response.session_id) {
          this.handleHistoryMessages(response.session_id, response.messages);
        }
        break;

      case "sessions_response":
        // Sessions list response
        if (response.sessions) {
          this.handleSessionsResponse(response.sessions);
        }
        break;

      default:
        // Unknown type, try to handle as chat response
        if (response.content) {
          const message: AgentMessage = {
            message_id: response.message_id || generateId(),
            session_id: response.session_id,
            message_type: response.message_type || "content",
            content: response.content,
            is_complete: response.is_complete ?? true,
          };
          this.handleAgentMessage(message);
        }
    }
  }

  /**
   * Request history messages from WebSocket
   */
  requestHistory(sessionId: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      ztoolkit.log("WebSocket not connected, cannot request history");
      return;
    }

    const request: WSRequest = {
      type: "get_history",
      session_id: sessionId,
    };
    this.websocket.send(JSON.stringify(request));
    ztoolkit.log("Requested history for session:", sessionId);
  }

  /**
   * Request sessions list from WebSocket
   */
  requestSessions(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      ztoolkit.log("WebSocket not connected, cannot request sessions");
      return;
    }

    const request: WSRequest = {
      type: "get_sessions",
    };
    this.websocket.send(JSON.stringify(request));
    ztoolkit.log("Requested sessions list");
  }

  /**
   * Handle sessions list response from WebSocket
   */
  private handleSessionsResponse(sessions: SessionInfo[]): void {
    ztoolkit.log("Received sessions list:", sessions);
    this.state.sessions = sessions.map((info) => ({
      session_id: info.session_id,
      messages: [],
      created_at: info.created_at ? new Date(info.created_at) : new Date(),
    }));
  }

  /**
   * Create new chat session
   */
  private createNewSession(): void {
    const session: ChatSession = {
      session_id: generateSessionId(),
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
