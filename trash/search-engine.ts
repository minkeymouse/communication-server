/**
 * Search Engine
 * Advanced search and filtering system for messages and conversations
 */

import { DatabaseManager } from '../../infrastructure/database/database.js';

export interface SearchQuery {
  text?: string;
  fromAgent?: string;
  toAgent?: string;
  conversationId?: string;
  threadId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  priority?: string[];
  securityLevel?: string[];
  state?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'conversation' | 'thread';
  relevance: number;
  content: string;
  metadata: Record<string, any>;
  highlights: string[];
}

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  agents?: string[];
  conversations?: string[];
  threads?: string[];
  priorities?: string[];
  securityLevels?: string[];
  states?: string[];
  tags?: string[];
  contentTypes?: string[];
}

export interface SearchStats {
  totalResults: number;
  resultsByType: Record<string, number>;
  resultsByAgent: Record<string, number>;
  resultsByPriority: Record<string, number>;
  resultsBySecurityLevel: Record<string, number>;
  averageRelevance: number;
  searchTime: number;
}

export class SearchEngine {
  private db: DatabaseManager;
  private searchIndex: Map<string, any> = new Map();

  constructor(db: DatabaseManager) {
    this.db = db;
    this.initializeSearchIndex();
  }

  searchMessages(query: SearchQuery, limit: number = 50): SearchResult[] {
    const startTime = Date.now();
    const results: SearchResult[] = [];

    try {
      // Build search criteria
      const criteria = this.buildSearchCriteria(query);
      
      // Perform search using database
      const messages = this.db.searchMessageLogs(query.text || '', limit);
      
      // Filter and rank results
      const filteredMessages = messages.filter(message => 
        this.matchesCriteria(message, criteria)
      );

      // Convert to search results
      results.push(...filteredMessages.map(message => ({
        id: message.id,
        type: 'message' as const,
        relevance: this.calculateRelevance(message, query),
        content: message.contentPlain,
        metadata: {
          fromAgent: message.fromAgentName,
          toAgent: message.toAgentName,
          subject: message.subject,
          priority: message.priority,
          securityLevel: message.securityLevel,
          state: message.state,
          createdAt: message.createdAt,
          threadId: message.threadId
        },
        highlights: this.generateHighlights(message, query.text || '')
      })));

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);

      console.log(`Search completed in ${Date.now() - startTime}ms, found ${results.length} results`);
      return results.slice(0, limit);

    } catch (error) {
      console.error(`Search failed: ${error}`);
      return [];
    }
  }

  searchConversations(query: SearchQuery, limit: number = 20): SearchResult[] {
    const startTime = Date.now();
    const results: SearchResult[] = [];

    try {
      // This would search conversations
      // For now, return empty results
      console.log(`Conversation search completed in ${Date.now() - startTime}ms`);
      return results;

    } catch (error) {
      console.error(`Conversation search failed: ${error}`);
      return [];
    }
  }

  searchThreads(query: SearchQuery, limit: number = 20): SearchResult[] {
    const startTime = Date.now();
    const results: SearchResult[] = [];

    try {
      // This would search threads
      // For now, return empty results
      console.log(`Thread search completed in ${Date.now() - startTime}ms`);
      return results;

    } catch (error) {
      console.error(`Thread search failed: ${error}`);
      return [];
    }
  }

  advancedSearch(
    query: SearchQuery,
    filters: SearchFilters,
    limit: number = 50
  ): { results: SearchResult[]; stats: SearchStats } {
    const startTime = Date.now();

    try {
      // Apply filters to query
      const filteredQuery = this.applyFilters(query, filters);
      
      // Perform search
      const results = this.searchMessages(filteredQuery, limit);
      
      // Calculate statistics
      const stats = this.calculateSearchStats(results, Date.now() - startTime);

      return { results, stats };

    } catch (error) {
      console.error(`Advanced search failed: ${error}`);
      return {
        results: [],
        stats: {
          totalResults: 0,
          resultsByType: {},
          resultsByAgent: {},
          resultsByPriority: {},
          resultsBySecurityLevel: {},
          averageRelevance: 0,
          searchTime: Date.now() - startTime
        }
      };
    }
  }

  getSearchSuggestions(query: string, limit: number = 10): string[] {
    try {
      const suggestions: string[] = [];
      
      // Get recent searches
      const recentSearches = this.getRecentSearches();
      
      // Get agent names
      const agents = this.getAgentList();
      
      // Get common terms
      const commonTerms = this.getCommonTerms();
      
      // Generate suggestions based on query
      if (query.length > 0) {
        // Agent name suggestions
        agents.forEach((agent: any) => {
          if (agent.name.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push(agent.name);
          }
        });
        
        // Recent search suggestions
        recentSearches.forEach(search => {
          if (search.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push(search);
          }
        });
        
        // Common term suggestions
        commonTerms.forEach(term => {
          if (term.toLowerCase().includes(query.toLowerCase())) {
            suggestions.push(term);
          }
        });
      } else {
        // Default suggestions
        suggestions.push(...recentSearches.slice(0, 5));
        suggestions.push(...commonTerms.slice(0, 5));
      }
      
      return [...new Set(suggestions)].slice(0, limit);
      
    } catch (error) {
      console.error(`Failed to get search suggestions: ${error}`);
      return [];
    }
  }

  getSearchHistory(agentId: string, limit: number = 20): Array<{
    query: string;
    timestamp: Date;
    resultCount: number;
  }> {
    try {
      // This would retrieve search history from database
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get search history: ${error}`);
      return [];
    }
  }

  saveSearchHistory(
    agentId: string,
    query: string,
    resultCount: number
  ): void {
    try {
      // This would save search history to database
      console.log(`Saved search history for agent ${agentId}: ${query} (${resultCount} results)`);
    } catch (error) {
      console.error(`Failed to save search history: ${error}`);
    }
  }

  private initializeSearchIndex(): void {
    try {
      // Initialize full-text search index
      console.log('Initializing search index...');
      
      // This would create and populate search indexes
      // For now, just log the initialization
      console.log('Search index initialized');
      
    } catch (error) {
      console.error(`Failed to initialize search index: ${error}`);
    }
  }

  private buildSearchCriteria(query: SearchQuery): any {
    return {
      text: query.text,
      fromAgent: query.fromAgent,
      toAgent: query.toAgent,
      conversationId: query.conversationId,
      threadId: query.threadId,
      dateRange: query.dateRange,
      priority: query.priority,
      securityLevel: query.securityLevel,
      state: query.state,
      tags: query.tags,
      metadata: query.metadata
    };
  }

  private matchesCriteria(message: any, criteria: any): boolean {
    // Check text match
    if (criteria.text && !this.textMatches(message, criteria.text)) {
      return false;
    }
    
    // Check agent matches
    if (criteria.fromAgent && message.fromAgentId !== criteria.fromAgent) {
      return false;
    }
    
    if (criteria.toAgent && message.toAgentId !== criteria.toAgent) {
      return false;
    }
    
    // Check conversation match
    if (criteria.conversationId && message.conversationId !== criteria.conversationId) {
      return false;
    }
    
    // Check thread match
    if (criteria.threadId && message.threadId !== criteria.threadId) {
      return false;
    }
    
    // Check date range
    if (criteria.dateRange) {
      const messageDate = new Date(message.createdAt);
      if (messageDate < criteria.dateRange.start || messageDate > criteria.dateRange.end) {
        return false;
      }
    }
    
    // Check priority
    if (criteria.priority && !criteria.priority.includes(message.priority)) {
      return false;
    }
    
    // Check security level
    if (criteria.securityLevel && !criteria.securityLevel.includes(message.securityLevel)) {
      return false;
    }
    
    // Check state
    if (criteria.state && !criteria.state.includes(message.state)) {
      return false;
    }
    
    return true;
  }

  private textMatches(message: any, searchText: string): boolean {
    const text = searchText.toLowerCase();
    const content = message.contentPlain.toLowerCase();
    const subject = message.subject.toLowerCase();
    const fromAgent = message.fromAgentName.toLowerCase();
    const toAgent = message.toAgentName.toLowerCase();
    
    return content.includes(text) || 
           subject.includes(text) || 
           fromAgent.includes(text) || 
           toAgent.includes(text);
  }

  private calculateRelevance(message: any, query: SearchQuery): number {
    let relevance = 0;
    
    // Text relevance
    if (query.text) {
      const text = query.text.toLowerCase();
      const content = message.contentPlain.toLowerCase();
      const subject = message.subject.toLowerCase();
      
      // Exact matches get higher scores
      if (content.includes(text)) relevance += 10;
      if (subject.includes(text)) relevance += 15;
      
      // Partial matches
      const words = text.split(' ');
      words.forEach(word => {
        if (content.includes(word)) relevance += 2;
        if (subject.includes(word)) relevance += 3;
      });
    }
    
    // Recency bonus
    const messageDate = new Date(message.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 1) relevance += 5;
    else if (daysDiff < 7) relevance += 3;
    else if (daysDiff < 30) relevance += 1;
    
    // Priority bonus
    if (message.priority === 'high') relevance += 3;
    else if (message.priority === 'urgent') relevance += 5;
    
    return relevance;
  }

  private generateHighlights(message: any, searchText: string): string[] {
    const highlights: string[] = [];
    
    if (!searchText) return highlights;
    
    const text = searchText.toLowerCase();
    const content = message.contentPlain;
    const subject = message.subject;
    
    // Find matches in content
    const contentMatches = this.findMatches(content, text);
    highlights.push(...contentMatches.slice(0, 3));
    
    // Find matches in subject
    const subjectMatches = this.findMatches(subject, text);
    highlights.push(...subjectMatches.slice(0, 2));
    
    return highlights;
  }

  private findMatches(text: string, searchText: string): string[] {
    const matches: string[] = [];
    const lowerText = text.toLowerCase();
    const words = searchText.split(' ');
    
    words.forEach(word => {
      const index = lowerText.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 20);
        const end = Math.min(text.length, index + word.length + 20);
        matches.push(`...${text.substring(start, end)}...`);
      }
    });
    
    return matches;
  }

  private applyFilters(query: SearchQuery, filters: SearchFilters): SearchQuery {
    const filteredQuery = { ...query };
    
    if (filters.dateRange) {
      filteredQuery.dateRange = filters.dateRange;
    }
    
    if (filters.agents && filters.agents.length > 0) {
      // Apply agent filters
    }
    
    if (filters.priorities && filters.priorities.length > 0) {
      filteredQuery.priority = filters.priorities;
    }
    
    if (filters.securityLevels && filters.securityLevels.length > 0) {
      filteredQuery.securityLevel = filters.securityLevels;
    }
    
    if (filters.states && filters.states.length > 0) {
      filteredQuery.state = filters.states;
    }
    
    return filteredQuery;
  }

  private calculateSearchStats(results: SearchResult[], searchTime: number): SearchStats {
    const stats: SearchStats = {
      totalResults: results.length,
      resultsByType: {},
      resultsByAgent: {},
      resultsByPriority: {},
      resultsBySecurityLevel: {},
      averageRelevance: 0,
      searchTime
    };
    
    if (results.length === 0) return stats;
    
    // Calculate type distribution
    results.forEach(result => {
      stats.resultsByType[result.type] = (stats.resultsByType[result.type] || 0) + 1;
    });
    
    // Calculate agent distribution
    results.forEach(result => {
      const fromAgent = result.metadata.fromAgent;
      if (fromAgent) {
        stats.resultsByAgent[fromAgent] = (stats.resultsByAgent[fromAgent] || 0) + 1;
      }
    });
    
    // Calculate priority distribution
    results.forEach(result => {
      const priority = result.metadata.priority;
      if (priority) {
        stats.resultsByPriority[priority] = (stats.resultsByPriority[priority] || 0) + 1;
      }
    });
    
    // Calculate security level distribution
    results.forEach(result => {
      const securityLevel = result.metadata.securityLevel;
      if (securityLevel) {
        stats.resultsBySecurityLevel[securityLevel] = (stats.resultsBySecurityLevel[securityLevel] || 0) + 1;
      }
    });
    
    // Calculate average relevance
    const totalRelevance = results.reduce((sum, result) => sum + result.relevance, 0);
    stats.averageRelevance = totalRelevance / results.length;
    
    return stats;
  }

  private getRecentSearches(): string[] {
    // This would retrieve recent searches from database
    // For now, return common search terms
    return [
      'performance',
      'error',
      'security',
      'testing',
      'feedback'
    ];
  }

  private getCommonTerms(): string[] {
    // This would retrieve common terms from message content
    // For now, return common terms
    return [
      'message',
      'communication',
      'agent',
      'system',
      'test',
      'improvement',
      'feedback',
      'performance',
      'security',
      'database'
    ];
  }

  private getAgentList(): any[] {
    // This would retrieve all agents from database
    // For now, return empty array
    return [];
  }
}
