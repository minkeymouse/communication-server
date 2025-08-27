/**
 * Simplified Database Manager
 * Orchestrates database operations using specialized repositories
 */

import { DatabaseConnection } from './connection.js';
import { DatabaseSchema } from './schema.js';
import { AgentRepository } from './repositories/agent-repository.js';
import { MessageRepository } from './repositories/message-repository.js';
import { SessionRepository } from './repositories/session-repository.js';
import { MessageLogRepository } from './repositories/message-log-repository.js';
import { Agent, Message, MessageState } from '../../domain/agents/models.js';
import { Session } from './repositories/session-repository.js';

export class DatabaseManager {
  private connection: DatabaseConnection;
  private schema: DatabaseSchema;
  private agentRepo: AgentRepository;
  private messageRepo: MessageRepository;
  private sessionRepo: SessionRepository;
  private messageLogRepo: MessageLogRepository;

  constructor(dbPath?: string) {
    this.connection = new DatabaseConnection(dbPath);
    const db = this.connection.getDatabase();
    
    this.schema = new DatabaseSchema(db);
    this.agentRepo = new AgentRepository(db);
    this.messageRepo = new MessageRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.messageLogRepo = new MessageLogRepository(db);

    this.schema.initializeSchema();
  }

  // Agent operations
  public createAgent(agent: Agent): string {
    return this.agentRepo.createAgent(agent);
  }

  public getAgent(agentId: string): Agent | null {
    return this.agentRepo.getAgent(agentId);
  }

  public getAgentByWorkspace(workspacePath: string): Agent | null {
    return this.agentRepo.getAgentByWorkspace(workspacePath);
  }

  public getAgentsByWorkspace(workspacePath: string): Agent[] {
    return this.agentRepo.getAgentsByWorkspace(workspacePath);
  }

  public getAgentByNameAndWorkspace(name: string, workspacePath: string): Agent | null {
    return this.agentRepo.getAgentByNameAndWorkspace(name, workspacePath);
  }

  public updateAgentLastSeen(agentId: string): void {
    this.agentRepo.updateAgentLastSeen(agentId);
  }

  public updateAgentName(agentId: string, name: string): void {
    this.agentRepo.updateAgentName(agentId, name);
  }

  public updateAgentRole(agentId: string, role: string): void {
    this.agentRepo.updateAgentRole(agentId, role as any);
  }

  public deleteAgent(agentId: string, createdBy?: string): boolean {
    return this.agentRepo.deleteAgent(agentId, createdBy);
  }

  public getAllActiveAgents(): Agent[] {
    return this.agentRepo.getAllActiveAgents();
  }

  public getAgentsByRole(role: string): Agent[] {
    return this.agentRepo.getAgentsByRole(role);
  }

  public getAgentsByCapability(capability: string): Agent[] {
    return this.agentRepo.getAgentsByCapability(capability);
  }

  public getAgentsByTag(tag: string): Agent[] {
    return this.agentRepo.getAgentsByTag(tag);
  }

  public countAgentsInWorkspace(workspacePath: string): number {
    return this.agentRepo.countAgentsInWorkspace(workspacePath);
  }

  public countAgentsTotal(): number {
    return this.agentRepo.countAgentsTotal();
  }

  public getAgentByName(name: string): Agent | null {
    return this.agentRepo.getAgentByName(name);
  }

  public findGhostAgentsOlderThan(days: number = 7, noMessagesOnly: boolean = true): Agent[] {
    return this.agentRepo.findGhostAgentsOlderThan(days, noMessagesOnly);
  }

  // Message operations
  public createMessage(message: Message): string {
    return this.messageRepo.createMessage(message);
  }

  public getMessage(messageId: string): Message | null {
    return this.messageRepo.getMessage(messageId);
  }

  public getMessagesForAgent(agentId: string, limit: number = 50): Message[] {
    return this.messageRepo.getMessagesForAgent(agentId, limit);
  }

  public getMessagesFromAgent(agentId: string, limit: number = 50): Message[] {
    return this.messageRepo.getMessagesFromAgent(agentId, limit);
  }

  public getMessagesByConversation(conversationId: string): Message[] {
    return this.messageRepo.getMessagesByConversation(conversationId);
  }

  public updateMessageState(messageId: string, state: MessageState): boolean {
    return this.messageRepo.updateMessageState(messageId, state);
  }

  public markMessageAsRead(messageId: string): boolean {
    return this.messageRepo.markMessageAsRead(messageId);
  }

  public markMessageAsReplied(messageId: string): boolean {
    return this.messageRepo.markMessageAsReplied(messageId);
  }

  public archiveMessage(messageId: string): boolean {
    return this.messageRepo.archiveMessage(messageId);
  }

  public deleteMessage(messageId: string): boolean {
    return this.messageRepo.deleteMessage(messageId);
  }

  public deleteMessages(agentId: string, messageIds?: string[]): number {
    return this.messageRepo.deleteMessages(agentId, messageIds);
  }

  public getMessageCountForAgent(agentId: string): number {
    return this.messageRepo.getMessageCountForAgent(agentId);
  }

  public getUnreadMessageCountForAgent(agentId: string): number {
    return this.messageRepo.getUnreadMessageCountForAgent(agentId);
  }

  public searchMessages(agentId: string, query: string, limit: number = 50): Message[] {
    return this.messageRepo.searchMessages(agentId, query, limit);
  }

  public getMessagesByPriority(agentId: string, priority: string): Message[] {
    return this.messageRepo.getMessagesByPriority(agentId, priority as any);
  }

  public getMessagesByState(agentId: string, state: MessageState): Message[] {
    return this.messageRepo.getMessagesByState(agentId, state);
  }

  public getRecentMessages(limit: number = 100): Message[] {
    return this.messageRepo.getRecentMessages(limit);
  }

  public getMessagesInDateRange(startDate: Date, endDate: Date): Message[] {
    return this.messageRepo.getMessagesInDateRange(startDate, endDate);
  }

  public getTotalMessageCount(): number {
    return this.messageRepo.getTotalMessageCount();
  }

  public getMessagesRequiringReply(agentId: string): Message[] {
    return this.messageRepo.getMessagesRequiringReply(agentId);
  }

  public emptyMailbox(workspacePath: string, query?: string): number {
    // This is a simplified implementation - in a real system you'd want more sophisticated filtering
    if (query) {
      // For now, just return 0 as we don't have complex query filtering implemented
      return 0;
    }
    
    // Get all agents in the workspace and delete their messages
    const agents = this.getAgentsByWorkspace(workspacePath);
    let totalDeleted = 0;
    
    for (const agent of agents) {
      totalDeleted += this.deleteMessages(agent.id);
    }
    
    return totalDeleted;
  }

  // Session operations
  public createSession(agentId: string, sessionMinutes: number): Session {
    return this.sessionRepo.createSession(agentId, sessionMinutes);
  }

  public getSession(sessionToken: string): Session | null {
    return this.sessionRepo.getSession(sessionToken);
  }

  public getActiveSessionsForAgent(agentId: string): Session[] {
    return this.sessionRepo.getActiveSessionsForAgent(agentId);
  }

  public deactivateSession(sessionToken: string): boolean {
    return this.sessionRepo.deactivateSession(sessionToken);
  }

  public deactivateAllSessionsForAgent(agentId: string): number {
    return this.sessionRepo.deactivateAllSessionsForAgent(agentId);
  }

  public cleanupExpiredSessions(): number {
    return this.sessionRepo.cleanupExpiredSessions();
  }

  public getActiveSessionsCount(): number {
    return this.sessionRepo.getActiveSessionsCount();
  }

  public getTotalSessionsCount(): number {
    return this.sessionRepo.getTotalSessionsCount();
  }

  public getSessionsByAgent(agentId: string): Session[] {
    return this.sessionRepo.getSessionsByAgent(agentId);
  }

  public getSessionsInDateRange(startDate: Date, endDate: Date): Session[] {
    return this.sessionRepo.getSessionsInDateRange(startDate, endDate);
  }

  public deleteSession(sessionId: string): boolean {
    return this.sessionRepo.deleteSession(sessionId);
  }

  public deleteExpiredSessions(): number {
    return this.sessionRepo.deleteExpiredSessions();
  }

  public extendSession(sessionToken: string, additionalMinutes: number): boolean {
    return this.sessionRepo.extendSession(sessionToken, additionalMinutes);
  }

  public isSessionValid(sessionToken: string): boolean {
    return this.sessionRepo.isSessionValid(sessionToken);
  }

  // Database statistics
  public getDatabaseStats(): any {
    return {
      activeAgents: this.countAgentsTotal(),
      totalMessages: this.getTotalMessageCount(),
      activeSessions: this.getActiveSessionsCount(),
      totalSessions: this.getTotalSessionsCount(),
      databasePath: this.connection.getDbPath()
    };
  }

  // Cleanup operations
  public cleanup(): void {
    this.cleanupExpiredSessions();
    this.deleteExpiredSessions();
  }

  // Message Log operations
  public createMessageLog(log: any): string {
    return this.messageLogRepo.createMessageLog(log);
  }

  public getMessageLogsByAgent(agentId: string, limit: number = 100): any[] {
    return this.messageLogRepo.getMessageLogsByAgent(agentId, limit);
  }

  public searchMessageLogs(query: string, limit: number = 50): any[] {
    return this.messageLogRepo.searchMessageLogs(query, limit);
  }

  public getMessageLogsByDateRange(startDate: Date, endDate: Date, limit: number = 100): any[] {
    return this.messageLogRepo.getMessageLogsByDateRange(startDate, endDate, limit);
  }

  public getMessageLogsByConversation(conversationId: string): any[] {
    return this.messageLogRepo.getMessageLogsByConversation(conversationId);
  }

  public getMessageLogsByThread(threadId: string): any[] {
    return this.messageLogRepo.getMessageLogsByThread(threadId);
  }

  public updateMessageLogState(messageId: string, state: string, readAt?: Date, repliedAt?: Date): boolean {
    return this.messageLogRepo.updateMessageLogState(messageId, state, readAt, repliedAt);
  }

  public getTotalMessageLogCount(): number {
    return this.messageLogRepo.getTotalMessageLogCount();
  }

  public getMessageLogsByPriority(priority: string, limit: number = 50): any[] {
    return this.messageLogRepo.getMessageLogsByPriority(priority, limit);
  }

  public close(): void {
    this.connection.close();
  }
}
