/**
 * Domain Enums
 * Centralized location for all domain enums
 */

export enum AgentRole {
  GENERAL = "general",
  DEVELOPER = "developer",
  MANAGER = "manager",
  ANALYST = "analyst",
  TESTER = "tester",
  DESIGNER = "designer",
  COORDINATOR = "coordinator"
}

export enum MessageState {
  SENT = "sent",
  ARRIVED = "arrived",
  REPLIED = "replied",
  IGNORED = "ignored",
  READ = "read",
  UNREAD = "unread"
}

export enum MessagePriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent"
}

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

export enum SecurityLevel {
  NONE = 'none',
  BASIC = 'basic',
  SIGNED = 'signed',
  ENCRYPTED = 'encrypted'
}
