/**
 * Message Handler
 * Handles bulk message management operations
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';
import { MessageState } from '../../domain/agents/models.js';

export class MessageHandler {
  constructor(private db: DatabaseManager) {}

  async handleManageMessages(args: any): Promise<any> {
    const { action, session_token, agent_id, message_ids, new_state, query } = args;
    
    if (!action) {
      throw new Error('action is required');
    }

    switch (action) {
      case 'mark_read':
        if (!message_ids || !Array.isArray(message_ids)) {
          throw new Error('message_ids array is required for mark_read action');
        }
        return await this.handleBulkMarkRead(message_ids);
      
      case 'update_states':
        if (!message_ids || !Array.isArray(message_ids)) {
          throw new Error('message_ids array is required for update_states action');
        }
        if (!new_state) {
          throw new Error('new_state is required for update_states action');
        }
        return await this.handleBulkUpdateStates(message_ids, new_state);
      
      case 'delete':
        if (!agent_id) {
          throw new Error('agent_id is required for delete action');
        }
        const deletedCount = message_ids ? this.db.deleteMessages(agent_id, message_ids) : 0;
        return { deleted_count: deletedCount, message_ids };
      
      case 'empty_mailbox':
        return await this.handleEmptyMailbox(query);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async handleBulkMarkRead(messageIds: string[]): Promise<any> {
    const startTime = Date.now();
    
    if (messageIds.length === 0) {
      throw new Error('message_ids array cannot be empty');
    }
    if (messageIds.length > 1000) {
      throw new Error('Cannot process more than 1000 messages at once');
    }

    let successCount = 0;
    const errors: string[] = [];
    
    // Process messages with error handling
    for (const messageId of messageIds) {
      try {
        if (typeof messageId !== 'string') {
          errors.push(`Invalid message ID: ${messageId}`);
          continue;
        }
        
        this.db.markMessageAsRead(messageId);
        successCount++;
      } catch (error: any) {
        errors.push(`Error updating message ${messageId}: ${error.message}`);
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      total_messages: messageIds.length,
      marked_read: successCount,
      failed_count: messageIds.length - successCount,
      errors: errors.length > 0 ? errors : undefined,
      execution_time_ms: executionTime
    };
  }

  private async handleBulkUpdateStates(messageIds: string[], newState: string): Promise<any> {
    if (messageIds.length === 0) {
      throw new Error('message_ids array cannot be empty');
    }
    if (messageIds.length > 1000) {
      throw new Error('Cannot process more than 1000 messages at once');
    }

    let successCount = 0;
    const errors: string[] = [];
    
    for (const messageId of messageIds) {
      try {
        if (typeof messageId !== 'string') {
          errors.push(`Invalid message ID: ${messageId}`);
          continue;
        }
        
        this.db.updateMessageState(messageId, newState as MessageState);
        successCount++;
      } catch (error: any) {
        errors.push(`Error updating message ${messageId}: ${error.message}`);
      }
    }

    return {
      total_messages: messageIds.length,
      updated: successCount,
      failed: messageIds.length - successCount,
      errors: errors.length > 0 ? errors : undefined,
      new_state: newState
    };
  }

  private async handleEmptyMailbox(query?: string): Promise<any> {
    const deletedCount = this.db.emptyMailbox('', query);

    return {
      deleted_messages: deletedCount,
      workspace_path: '',
      query: query || null
    };
  }
}
