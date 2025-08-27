/**
 * Agent validation logic
 */

import { Agent, AgentRole, AgentStatus } from '../../domain/agents/models.js';
import { ValidationResult, ValidationError } from '../../shared/types/common.js';
import { AGENT_CONSTANTS } from '../../shared/constants/index.js';

export class AgentValidator {
  /**
   * Validate agent creation data
   */
  static validateCreateAgent(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate agent_id
    if (!data.agent_id) {
      errors.push({
        field: 'agent_id',
        message: 'agent_id is required for agent creation',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.agent_id !== 'string') {
      errors.push({
        field: 'agent_id',
        message: 'agent_id must be a string',
        value: data.agent_id,
        code: 'INVALID_TYPE'
      });
    } else if (data.agent_id.length > 100) {
      errors.push({
        field: 'agent_id',
        message: 'agent_id must be 100 characters or less',
        value: data.agent_id,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate name
    if (!data.name) {
      errors.push({
        field: 'name',
        message: 'name is required for agent creation',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'name must be a string',
        value: data.name,
        code: 'INVALID_TYPE'
      });
    } else if (data.name.length > AGENT_CONSTANTS.MAX_NAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `name must be ${AGENT_CONSTANTS.MAX_NAME_LENGTH} characters or less`,
        value: data.name,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate workspace_path
    if (!data.workspace_path) {
      errors.push({
        field: 'workspace_path',
        message: 'workspace_path is required for agent creation',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.workspace_path !== 'string') {
      errors.push({
        field: 'workspace_path',
        message: 'workspace_path must be a string',
        value: data.workspace_path,
        code: 'INVALID_TYPE'
      });
    } else if (data.workspace_path.length > AGENT_CONSTANTS.MAX_WORKSPACE_PATH_LENGTH) {
      errors.push({
        field: 'workspace_path',
        message: `workspace_path must be ${AGENT_CONSTANTS.MAX_WORKSPACE_PATH_LENGTH} characters or less`,
        value: data.workspace_path,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate role
    if (data.role && !Object.values(AgentRole).includes(data.role)) {
      errors.push({
        field: 'role',
        message: `role must be one of: ${Object.values(AgentRole).join(', ')}`,
        value: data.role,
        code: 'INVALID_VALUE'
      });
    }

    // Validate description
    if (data.description && typeof data.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'description must be a string',
        value: data.description,
        code: 'INVALID_TYPE'
      });
    } else if (data.description && data.description.length > AGENT_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        message: `description must be ${AGENT_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters or less`,
        value: data.description,
        code: 'MAX_LENGTH_EXCEEDED'
      });
    }

    // Validate capabilities
    if (data.capabilities) {
      if (!Array.isArray(data.capabilities)) {
        errors.push({
          field: 'capabilities',
          message: 'capabilities must be an array',
          value: data.capabilities,
          code: 'INVALID_TYPE'
        });
      } else if (data.capabilities.length > AGENT_CONSTANTS.MAX_CAPABILITIES) {
        errors.push({
          field: 'capabilities',
          message: `capabilities cannot exceed ${AGENT_CONSTANTS.MAX_CAPABILITIES} items`,
          value: data.capabilities,
          code: 'MAX_ITEMS_EXCEEDED'
        });
      } else {
        data.capabilities.forEach((capability: any, index: number) => {
          if (typeof capability !== 'string') {
            errors.push({
              field: `capabilities[${index}]`,
              message: 'each capability must be a string',
              value: capability,
              code: 'INVALID_TYPE'
            });
          }
        });
      }
    }

    // Validate tags
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push({
          field: 'tags',
          message: 'tags must be an array',
          value: data.tags,
          code: 'INVALID_TYPE'
        });
      } else if (data.tags.length > AGENT_CONSTANTS.MAX_TAGS) {
        errors.push({
          field: 'tags',
          message: `tags cannot exceed ${AGENT_CONSTANTS.MAX_TAGS} items`,
          value: data.tags,
          code: 'MAX_ITEMS_EXCEEDED'
        });
      } else {
        data.tags.forEach((tag: any, index: number) => {
          if (typeof tag !== 'string') {
            errors.push({
              field: `tags[${index}]`,
              message: 'each tag must be a string',
              value: tag,
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
   * Validate agent login data
   */
  static validateLogin(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate agent_id
    if (!data.agent_id) {
      errors.push({
        field: 'agent_id',
        message: 'agent_id is required for login',
        code: 'REQUIRED_FIELD'
      });
    } else if (typeof data.agent_id !== 'string') {
      errors.push({
        field: 'agent_id',
        message: 'agent_id must be a string',
        value: data.agent_id,
        code: 'INVALID_TYPE'
      });
    }

    // Validate session_minutes
    if (data.session_minutes !== undefined) {
      if (typeof data.session_minutes !== 'number') {
        errors.push({
          field: 'session_minutes',
          message: 'session_minutes must be a number',
          value: data.session_minutes,
          code: 'INVALID_TYPE'
        });
      } else if (data.session_minutes < AGENT_CONSTANTS.SESSION_MINUTES_MIN || 
                 data.session_minutes > AGENT_CONSTANTS.SESSION_MINUTES_MAX) {
        errors.push({
          field: 'session_minutes',
          message: `session_minutes must be between ${AGENT_CONSTANTS.SESSION_MINUTES_MIN} and ${AGENT_CONSTANTS.SESSION_MINUTES_MAX}`,
          value: data.session_minutes,
          code: 'OUT_OF_RANGE'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate agent update data
   */
  static validateUpdateAgent(data: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate agent_id
    if (!data.agent_id) {
      errors.push({
        field: 'agent_id',
        message: 'agent_id is required for agent update',
        code: 'REQUIRED_FIELD'
      });
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (typeof data.name !== 'string') {
        errors.push({
          field: 'name',
          message: 'name must be a string',
          value: data.name,
          code: 'INVALID_TYPE'
        });
      } else if (data.name.length > AGENT_CONSTANTS.MAX_NAME_LENGTH) {
        errors.push({
          field: 'name',
          message: `name must be ${AGENT_CONSTANTS.MAX_NAME_LENGTH} characters or less`,
          value: data.name,
          code: 'MAX_LENGTH_EXCEEDED'
        });
      }
    }

    // Validate role if provided
    if (data.role !== undefined && !Object.values(AgentRole).includes(data.role)) {
      errors.push({
        field: 'role',
        message: `role must be one of: ${Object.values(AgentRole).join(', ')}`,
        value: data.role,
        code: 'INVALID_VALUE'
      });
    }

    // Validate status if provided
    if (data.status !== undefined && !Object.values(AgentStatus).includes(data.status)) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${Object.values(AgentStatus).join(', ')}`,
        value: data.status,
        code: 'INVALID_VALUE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
