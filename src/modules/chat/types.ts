/**
 * ZoteroClaw Chat - Message Types
 */

/**
 * WebSocket request types - sent from client to backend
 */
export type WSRequestType = 'chat' | 'get_history' | 'get_sessions';

/**
 * WebSocket response types - received from backend
 */
export type WSResponseType = 'get_sessions_response' | 'get_history_response';

/**
 * Message role types - from backend
 */
export type MessageRole = 'user' | 'assistant' | 'tool';

/**
 * UI message types - for rendering
 */
export type UIMessageType = 'user' | 'thinking' | 'content' | 'tool';

/**
 * File attachment structure - uses absolute file path
 */
export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  path: string;  // Absolute file path
}

/**
 * WebSocket request - sent from client to backend
 */
export interface WSRequest {
  type: WSRequestType;
  session_id?: string;
  message?: string;  // For chat request
}

/**
 * WebSocket chat message - received from backend during chat
 */
export interface WSChatMessage {
  session_id: string;
  id: string;
  role: MessageRole;
  content: string;
  reasoning_content?: string | null;
  finish?: boolean;  // True indicates response is complete
}

/**
 * WebSocket response - received from backend
 */
export interface WSResponse {
  type: WSResponseType;
  session_id?: string;
  session_ids?: string[];         // For get_sessions_response
  messages?: BackendMessage[];    // For get_history_response
}

/**
 * Backend message structure - received from backend
 */
export interface BackendMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning_content?: string | null;
}

/**
 * User message structure - for internal use
 */
export interface UserMessage {
  session_id: string;
  user_query: string;
  attachments?: FileAttachment[];
}

/**
 * Agent message structure - for UI rendering
 */
export interface AgentMessage {
  message_id: string;
  session_id: string;
  message_type: UIMessageType;
  content: string;
  is_complete: boolean;
}

/**
 * Stored message - for session storage
 */
export interface StoredMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning_content?: string | null;
}

/**
 * Chat session - contains all messages in a conversation
 */
export interface ChatSession {
  session_id: string;
  messages: StoredMessage[];
  created_at: Date;
}

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