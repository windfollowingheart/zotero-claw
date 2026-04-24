/**
 * ZoteroClaw Chat - Message Types
 */

/**
 * Message types supported by the chat interface
 */
export type MessageType = "thinking" | "content" | "tool" | "user";

/**
 * WebSocket message types - for communication with backend
 */
export type WSMessageType =
  | "chat"
  | "get_history"
  | "get_sessions"
  | "chat_response"
  | "history_response"
  | "sessions_response"
  | "streaming"
  | "complete";

/**
 * File attachment structure
 */
export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data?: ArrayBuffer;
}

/**
 * WebSocket request - sent from client to backend
 */
export interface WSRequest {
  type: WSMessageType;
  session_id?: string;
  user_query?: string;
  attachments?: FileAttachment[];
}

/**
 * WebSocket response - received from backend
 */
export interface WSResponse {
  type: WSMessageType;
  session_id: string;
  message_id?: string;
  message_type?: MessageType;
  content?: string;
  is_complete?: boolean;
  submessages?: WSResponse[];
  messages?: HistoryMessage[]; // For history_response
  sessions?: SessionInfo[]; // For sessions_response
}

/**
 * Session info - for session list
 */
export interface SessionInfo {
  session_id: string;
  title?: string;
  created_at?: string;
  message_count?: number;
}

/**
 * User message structure - sent to agent
 */
export interface UserMessage {
  session_id: string;
  user_query: string;
  attachments?: FileAttachment[];
}

/**
 * Agent message structure - received from agent callback (streaming)
 * Can contain submessages for multi-step responses
 */
export interface AgentMessage {
  message_id: string;
  session_id: string;
  message_type: MessageType;
  content: string;
  is_complete: boolean;
  submessages?: AgentMessage[];
}

/**
 * Stored agent message with accumulated content
 * Can contain submessages for multi-step responses
 */
export interface StoredAgentMessage {
  message_id: string;
  session_id: string;
  message_type: MessageType;
  content: string;
  is_complete: boolean;
  submessages?: StoredAgentMessage[];
}

/**
 * History user message - for loading from history
 */
export interface HistoryUserMessage {
  message_type: "user";
  content: string;
}

/**
 * History agent message - for loading from history
 * Can contain submessages for multi-step responses
 */
export interface HistoryAgentMessage {
  message_type: "thinking" | "content" | "tool";
  content: string;
  submessages?: HistoryAgentMessage[];
}

/**
 * History message - union type
 */
export type HistoryMessage = HistoryUserMessage | HistoryAgentMessage;

/**
 * Chat session - contains all messages in a conversation
 */
export interface ChatSession {
  session_id: string;
  messages: (UserMessage | StoredAgentMessage)[];
  created_at: Date;
}

/**
 * Chat message - union of user and agent messages
 */
export type ChatMessage = UserMessage | AgentMessage;

/**
 * Message render state - for UI rendering
 */
export interface MessageRenderState {
  id: string;
  isCollapsed: boolean;
  isStreaming: boolean;
}

/**
 * Chat UI state
 */
export interface ChatUIState {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  inputValue: string;
  attachments: FileAttachment[];
  isLoading: boolean;
  isSending: boolean;
}
