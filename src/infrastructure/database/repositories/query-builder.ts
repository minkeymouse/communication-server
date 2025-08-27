/**
 * Query Builder
 * Handles complex SQL query construction for repositories
 */

export class QueryBuilder {
  /**
   * Build message search query with filters
   */
  static buildMessageSearchQuery(filters: {
    fromAgentId?: string;
    toAgentId?: string;
    state?: string;
    priority?: string;
    subject?: string;
    limit?: number;
    offset?: number;
  }): { query: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.fromAgentId) {
      conditions.push('from_agent_id = ?');
      params.push(filters.fromAgentId);
    }

    if (filters.toAgentId) {
      conditions.push('to_agent_id = ?');
      params.push(filters.toAgentId);
    }

    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }

    if (filters.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    if (filters.subject) {
      conditions.push('subject LIKE ?');
      params.push(`%${filters.subject}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
    const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';

    const query = `
      SELECT * FROM messages 
      ${whereClause}
      ORDER BY created_at DESC 
      ${limitClause}
      ${offsetClause}
    `.trim();

    return { query, params };
  }

  /**
   * Build conversation search query
   */
  static buildConversationSearchQuery(filters: {
    participantId?: string;
    subject?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): { query: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.participantId) {
      conditions.push('participants LIKE ?');
      params.push(`%${filters.participantId}%`);
    }

    if (filters.subject) {
      conditions.push('subject LIKE ?');
      params.push(`%${filters.subject}%`);
    }

    if (filters.isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
    const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';

    const query = `
      SELECT * FROM conversations 
      ${whereClause}
      ORDER BY updated_at DESC 
      ${limitClause}
      ${offsetClause}
    `.trim();

    return { query, params };
  }

  /**
   * Build agent search query
   */
  static buildAgentSearchQuery(filters: {
    role?: string;
    workspacePath?: string;
    isActive?: boolean;
    capabilities?: string;
    tags?: string;
    limit?: number;
    offset?: number;
  }): { query: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.role) {
      conditions.push('role = ?');
      params.push(filters.role);
    }

    if (filters.workspacePath) {
      conditions.push('workspace_path = ?');
      params.push(filters.workspacePath);
    }

    if (filters.isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }

    if (filters.capabilities) {
      conditions.push('capabilities LIKE ?');
      params.push(`%${filters.capabilities}%`);
    }

    if (filters.tags) {
      conditions.push('tags LIKE ?');
      params.push(`%${filters.tags}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
    const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';

    const query = `
      SELECT * FROM agents 
      ${whereClause}
      ORDER BY last_seen DESC 
      ${limitClause}
      ${offsetClause}
    `.trim();

    return { query, params };
  }

  /**
   * Build statistics query
   */
  static buildStatisticsQuery(type: 'messages' | 'agents' | 'conversations'): string {
    switch (type) {
      case 'messages':
        return `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN state = 'sent' THEN 1 END) as sent,
            COUNT(CASE WHEN state = 'read' THEN 1 END) as read,
            COUNT(CASE WHEN state = 'replied' THEN 1 END) as replied,
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
            COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_priority
          FROM messages
        `;
      
      case 'agents':
        return `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
            COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive,
            COUNT(CASE WHEN role = 'developer' THEN 1 END) as developers,
            COUNT(CASE WHEN role = 'manager' THEN 1 END) as managers
          FROM agents
        `;
      
      case 'conversations':
        return `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
            COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive,
            AVG(message_count) as avg_messages
          FROM conversations
        `;
      
      default:
        throw new Error(`Unknown statistics type: ${type}`);
    }
  }

  /**
   * Build pagination query
   */
  static buildPaginationQuery(baseQuery: string, page: number, pageSize: number): string {
    const offset = (page - 1) * pageSize;
    return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
  }
}
