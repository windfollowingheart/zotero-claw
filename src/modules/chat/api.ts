/**
 * ZoteroClaw Chat - API Interface
 *
 * This module provides callbacks for handling messages.
 * All communication is now handled via WebSocket in ui.ts.
 */

import type {
  AgentMessage,
  BackendMessage,
} from "./types";

/**
 * Agent message callback type
 */
export type AgentMessageCallback = (message: AgentMessage) => void;

/**
 * Response complete callback type
 */
export type ResponseCompleteCallback = (
  success: boolean,
  error?: string,
) => void;

/**
 * History messages callback type
 */
export type HistoryMessagesCallback = (
  sessionId: string,
  messages: BackendMessage[],
) => void;

/**
 * Chat API class - provides callback registration for message handling
 */
export class ChatAPI {
  private agentMessageCallback: AgentMessageCallback | null = null;
  private responseCompleteCallback: ResponseCompleteCallback | null = null;
  private historyMessagesCallback: HistoryMessagesCallback | null = null;

  /**
   * Register callback for receiving agent messages
   *
   * @param callback - Function to call when agent sends a message
   */
  registerAgentMessageCallback(callback: AgentMessageCallback): void {
    this.agentMessageCallback = callback;
  }

  /**
   * Unregister the agent message callback
   */
  unregisterAgentMessageCallback(): void {
    this.agentMessageCallback = null;
  }

  /**
   * Call agent message callback (used by WebSocket handler)
   */
  triggerAgentMessage(message: AgentMessage): void {
    if (this.agentMessageCallback) {
      this.agentMessageCallback(message);
    }
  }

  /**
   * Register callback for response completion
   *
   * @param callback - Function to call when all responses are complete
   */
  registerResponseCompleteCallback(callback: ResponseCompleteCallback): void {
    this.responseCompleteCallback = callback;
  }

  /**
   * Unregister the response complete callback
   */
  unregisterResponseCompleteCallback(): void {
    this.responseCompleteCallback = null;
  }

  /**
   * Call response complete callback (used by WebSocket handler)
   */
  triggerResponseComplete(success: boolean, error?: string): void {
    if (this.responseCompleteCallback) {
      this.responseCompleteCallback(success, error);
    }
  }

  /**
   * Register callback for loading history messages
   *
   * @param callback - Function to call when loading history messages
   */
  registerHistoryMessagesCallback(callback: HistoryMessagesCallback): void {
    this.historyMessagesCallback = callback;
  }

  /**
   * Unregister the history messages callback
   */
  unregisterHistoryMessagesCallback(): void {
    this.historyMessagesCallback = null;
  }

  /**
   * Call history messages callback (used by WebSocket handler)
   */
  triggerHistoryMessages(sessionId: string, messages: BackendMessage[]): void {
    if (this.historyMessagesCallback) {
      this.historyMessagesCallback(sessionId, messages);
    }
  }
}

/**
 * Global chat API instance
 */
export const chatAPI = new ChatAPI();