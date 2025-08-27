/**
 * Message validation logic
 */

import { Message, MessagePriority, MessageState, SecurityLevel } from '../../domain/agents/models.js';
import { ValidationResult, ValidationError } from '../../shared/types/common.js';
import { MESSAGE_CONSTANTS } from '../../shared/constants/index.js';

export class MessageValidator {
  /**
   * Validate message creation data
   */
  static validateSendMessage(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate title
    if (!data.title) {
      errors.push({
        field: 'title',
        message: 'title is required for sending messages',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.title !== 'string') {
      errors.push({
        field: 'title',
        message: 'title must be a string',
        value: data.title,
        code: 'INVALID_TYPE'
      });
    } else if (data.title.length > MESSAGE_CONSTANTS.MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        message: `title must be ${MESSAGE_CONSTANTS.MAX_TITLE_LENGTH} characters or less`,
        value: data.title,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate content
    if (!data.content) {
      errors.push({
        field: 'content',
        message: 'content is required for sending messages',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.content !== 'string') {
      errors.push({
        field: 'content',
        message: 'content must be a string',
        value: data.content,
        code: 'INVALID_TYPE'
      });
    } else if (data.content.length > MESSAGE_CONSTANTS.MAX_CONTENT_LENGTH) {
      errors.push({
        field: 'content',
        message: `content must be ${MESSAGE_CONSTANTS.MAX_CONTENT_LENGTH} characters or less`,
        value: data.content,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate to_agent_id or to_agent
    if (!data.to_agent_id && !data.to_agent) {
      errors.push({
        field: 'to_agent_id',
        message: 'either to_agent_id or to_agent is required',
        code: 'REQUIRED_FIELD'
      });
    } else {
      if (data.to_agent_id && typeof data.to_agent_id !== 'string') {
        errors.push({
          field: 'to_agent_id',
          message: 'to_agent_id must be a string',
          value: data.to_agent_id,
          code: 'INVALID_TYPE'
        });
      }
      if (data.to_agent && typeof data.to_agent !== 'string') {
        errors.push({
          field: 'to_agent',
          message: 'to_agent must be a string',
          value: data.to_agent,
          code: 'INVALID_TYPE'
        });
      }
    }

    // Validate priority
    if (data.priority && !Object.values(MessagePriority).includes(data.priority)) {
      errors.push({
        field: 'priority',
        message: `priority must be one of: ${Object.values(MessagePriority).join(', ')}`,
        value: data.priority,
        code: 'INVALID_VALUE'
      });
    }

    // Validate security_level
    if (data.security_level && !Object.values(SecurityLevel).includes(data.security_level)) {
      errors.push({
        field: 'security_level',
        message: `security_level must be one of: ${Object.values(SecurityLevel).join(', ')}`,
        value: data.security_level,
        code: 'INVALID_VALUE'
      });
    }

    // Validate attachments
    if (data.attachments) {
      if (!Array.isArray(data.attachments)) {
        errors.push({
          field: 'attachments',
          message: 'attachments must be an array',
          value: data.attachments,
          code: 'INVALID_TYPE'
        });
      } else if (data.attachments.length > MESSAGE_CONSTANTS.MAX_ATTACHMENTS) {
        errors.push({
          field: 'attachments',
          message: `attachments cannot exceed ${MESSAGE_CONSTANTS.MAX_ATTACHMENTS} items`,
          value: data.attachments,
          code: 'MAX_ITEMS_EXCEEDED'
        });
      } else {
        data.attachments.forEach((attachment: any, index: number) => {
          if (typeof attachment !== 'object' || attachment === null) {
            errors.push({
              field: `attachments[${index}]`,
              message: 'each attachment must be an object',
              value: attachment,
              code: 'INVALID_TYPE'
            });
          } else {
            if (!attachment.name || typeof attachment.name !== 'string') {
              errors.push({
                field: `attachments[${index}].name`,
                message: 'attachment name is required and must be a string',
                value: attachment.name,
                code: 'REQUIRED_FIELD'
              });
            }
            if (!attachment.type || typeof attachment.type !== 'string') {
              errors.push({
                field: `attachments[${index}].type`,
                message: 'attachment type is required and must be a string',
                value: attachment.type,
                code: 'REQUIRED_FIELD'
              });
            }
            if (attachment.size !== undefined && (typeof attachment.size !== 'number' || attachment.size < 0)) {
              errors.push({
                field: `attachments[${index}].size`,
                message: 'attachment size must be a positive number',
                value: attachment.size,
                code: 'INVALID_VALUE'
              });
            }
            if (attachment.size && attachment.size > MESSAGE_CONSTANTS.MAX_ATTACHMENT_SIZE) {
              errors.push({
                field: `attachments[${index}].size`,
                message: `attachment size cannot exceed ${MESSAGE_CONSTANTS.MAX_ATTACHMENT_SIZE} bytes`,
                value: attachment.size,
                code: 'MAX_SIZE_EXCEEDED'
              });
            }
          }
        });
      }
    }

    // Validate workflow-specific fields
    if (data.project_id && typeof data.project_id !== 'string') {
      errors.push({
        field: 'project_id',
        message: 'project_id must be a string',
        value: data.project_id,
        code: 'INVALID_TYPE'
      });
    }

    if (data.work_type && typeof data.work_type !== 'string') {
      errors.push({
        field: 'work_type',
        message: 'work_type must be a string',
        value: data.work_type,
        code: 'INVALID_TYPE'
      });
    }

    if (data.status && typeof data.status !== 'string') {
      errors.push({
        field: 'status',
        message: 'status must be a string',
        value: data.status,
        code: 'INVALID_TYPE'
      });
    }

    if (data.dependencies) {
      if (!Array.isArray(data.dependencies)) {
        errors.push({
          field: 'dependencies',
          message: 'dependencies must be an array',
          value: data.dependencies,
          code: 'INVALID_TYPE'
        });
      } else {
        data.dependencies.forEach((dependency: any, index: number) => {
          if (typeof dependency !== 'string') {
            errors.push({
              field: `dependencies[${index}]`,
              message: 'each dependency must be a string',
              value: dependency,
              code: 'INVALID_TYPE'
            });
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate message filter data
   */
  static validateMessageFilter(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate limit
    if (data.limit !== undefined) {
      if (typeof data.limit !== 'number') {
        errors.push({
          field: 'limit',
          message: 'limit must be a number',
          value: data.limit,
          code: 'INVALID_TYPE'
        });
      } else if (data.limit < 1 || data.limit > 1000) {
        errors.push({
          field: 'limit',
          message: 'limit must be between 1 and 1000',
          value: data.limit,
          code: 'OUT_OF_RANGE'
        });
      }
    }

    // Validate offset
    if (data.offset !== undefined) {
      if (typeof data.offset !== 'number') {
        errors.push({
          field: 'offset',
          message: 'offset must be a number',
          value: data.offset,
          code: 'INVALID_TYPE'
        });
      } else if (data.offset < 0) {
        errors.push({
          field: 'offset',
          message: 'offset must be non-negative',
          value: data.offset,
          code: 'OUT_OF_RANGE'
        });
      }
    }

    // Validate priority
    if (data.priority && !Object.values(MessagePriority).includes(data.priority)) {
      errors.push({
        field: 'priority',
        message: `priority must be one of: ${Object.values(MessagePriority).join(', ')}`,
        value: data.priority,
        code: 'INVALID_VALUE'
      });
    }

    // Validate state
    if (data.state && !Object.values(MessageState).includes(data.state)) {
      errors.push({
        field: 'state',
        message: `state must be one of: ${Object.values(MessageState).join(', ')}`,
        value: data.state,
        code: 'INVALID_VALUE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate bulk operations data
   */
  static validateBulkOperation(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate message_ids
    if (!data.message_ids) {
      errors.push({
        field: 'message_ids',
        message: 'message_ids is required for bulk operations',
        code: 'REQUIRED_FIELD'
      });
    } else if (!Array.isArray(data.message_ids)) {
      errors.push({
        field: 'message_ids',
        message: 'message_ids must be an array',
        value: data.message_ids,
        code: 'INVALID_TYPE'
      });
    } else if (data.message_ids.length === 0) {
      errors.push({
        field: 'message_ids',
        message: 'message_ids cannot be empty',
        value: data.message_ids,
        code: 'EMPTY_ARRAY'
      });
    } else if (data.message_ids.length > 1000) {
      errors.push({
        field: 'message_ids',
        message: 'Cannot process more than 1000 messages at once',
        value: data.message_ids,
        code: 'MAX_ITEMS_EXCEEDED'
      });
    } else {
      data.message_ids.forEach((messageId: any, index: number) => {
        if (typeof messageId !== 'string') {
          errors.push({
            field: `message_ids[${index}]`,
            message: 'each message_id must be a string',
            value: messageId,
            code: 'INVALID_TYPE'
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
