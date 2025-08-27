/**
 * Template Handler
 * Handles message templates and template-related operations
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';

export class TemplateHandler {
  constructor(private db: DatabaseManager) {}

  /**
   * Get message templates
   */
  async handleGetTemplates(args: any): Promise<any> {
    const { template_type, include_system_info = false } = args;
    
    const templates = {
      greeting: {
        title: 'Greeting',
        content: 'Hello! I hope this message finds you well. I wanted to reach out to discuss our recent collaboration and explore potential opportunities for further cooperation.'
      },
      task_request: {
        title: 'Task Request',
        content: '**Task Description:**\n\n**Requirements:**\n\n**Deadline:**\n\n**Priority:** (Low/Medium/High)\n\n**Additional Context:**\n\n**Expected Deliverables:**'
      },
      status_update: {
        title: 'Status Update',
        content: '**Current Status:**\n\n**Progress Made:**\n\n**Next Steps:**\n\n**Blockers:**\n\n**Timeline:**\n\n**Additional Notes:**'
      },
      feedback: {
        title: 'Feedback',
        content: '**Feedback Type:** (Positive/Constructive/Issue)\n\n**Subject:**\n\n**Details:**\n\n**Impact:**\n\n**Suggestions:**\n\n**Follow-up Required:**'
      },
      error_report: {
        title: 'Error Report',
        content: '**Error Description:**\n\n**Steps to Reproduce:**\n1. \n2. \n3. \n\n**Expected Behavior:**\n\n**Actual Behavior:**\n\n**Environment:**\n- System: \n- Version: \n\n**Additional Information:**'
      },
      completion_notice: {
        title: 'Task Completion Notice',
        content: '**Task Completed:**\n\n**Summary of Work:**\n\n**Results Achieved:**\n\n**Files/Resources Created:**\n\n**Next Steps:**\n\n**Additional Notes:**'
      }
    };
    
    const result: any = {};
    
    if (template_type && templates[template_type as keyof typeof templates]) {
      result.template = templates[template_type as keyof typeof templates];
    } else {
      result.available_templates = Object.keys(templates);
    }
    
    if (include_system_info) {
      result.system_info = {
        version: '2.0.0',
        server_time: new Date().toISOString(),
        total_agents: this.db.getAllActiveAgents().length,
        active_sessions: this.db.getActiveSessionsCount()
      };
    }
    
    return result;
  }

  /**
   * Get template metadata
   */
  getTemplateMetadata(): any {
    return {
      total_templates: 6,
      categories: ['communication', 'project_management', 'feedback'],
      last_updated: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}
