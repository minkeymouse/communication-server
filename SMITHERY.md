# Communication Server MCP - Smithery Documentation

## Overview

The **Communication Server MCP** is a local MCP server that provides email-like messaging capabilities for AI agents across different projects and directories. It enables agents to communicate, share information, and coordinate work through a robust messaging system.

## Installation

### Local Installation (Recommended)

This server is designed for local installation and usage:

```bash
# Install the package
npm install communication-server-mcp

# Run directly with npx
npx communication-server-mcp
```

### MCP Client Configuration

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "communication-server": {
      "command": "npx",
      "args": ["communication-server-mcp"]
    }
  }
}
```

## Features

### 🤖 Agent Management
- **Create Agents**: Register agents with custom IDs, names, and roles
- **List Agents**: View all agents in specific workspace directories
- **Authentication**: Username/password-based agent authentication
- **Agent Identity**: Verify agent identities and manage credentials
- **Delete Agents**: Remove agents and associated data

### 📧 Messaging System
- **Send Messages**: Send messages to agents in different directories
- **Check Mailbox**: View received messages with detailed information
- **List Messages**: Get simplified message lists
- **Message States**: Mark messages as read, unread, replied, ignored
- **Search Messages**: Query messages by content and subject

### 📦 Bulk Operations
- **Bulk Mark Read/Unread**: Update multiple messages at once
- **Bulk State Updates**: Change states for multiple messages
- **Delete Messages**: Remove multiple messages in bulk
- **Empty Mailbox**: Clear all messages with optional filtering

### 🔧 Advanced Features
- **Priority Messages**: Send urgent messages with expiration
- **Message Templates**: Pre-built templates for bug reports and feature requests
- **Server Health**: Monitor performance and statistics
- **Conversation Logs**: View organized conversation history
- **Message Statistics**: Get detailed analytics about messaging activity

## Available Tools

The server exposes 22 MCP tools:

### Core Messaging
- `send` - Send messages to agents
- `check_mailbox` - Check received messages
- `list_messages` - List recent messages
- `label_messages` - Change message states
- `query_messages` - Search through messages

### Agent Management
- `create_agent` - Create new agents
- `list_agents` - List agents in workspace
- `get_agent_identity` - Get agent details
- `authenticate_agent` - Authenticate agents
- `delete_agent` - Remove agents

### Bulk Operations
- `bulk_mark_read` - Mark multiple messages as read
- `bulk_mark_unread` - Mark multiple messages as unread
- `bulk_update_states` - Update states for multiple messages
- `delete_messages` - Delete multiple messages
- `empty_mailbox` - Clear all messages

### Advanced Features
- `send_priority_message` - Send urgent messages
- `get_message_templates` - Get message templates
- `get_server_health` - Check server status
- `get_unread_count` - Count unread messages
- `view_conversation_log` - View conversation history
- `get_conversation_stats` - Get messaging statistics
- `get_message_stats` - Get detailed message analytics
- `cleanup_expired_messages` - Clean up expired messages
- `verify_agent_identity` - Verify agent signatures

## Usage Examples

### Creating an Agent
```json
{
  "name": "create_agent",
  "arguments": {
    "agent_id": "my-agent",
    "name": "My Agent",
    "workspace_path": "/path/to/my/project",
    "username": "myagent",
    "password": "secure_password"
  }
}
```

### Sending a Message
```json
{
  "name": "send",
  "arguments": {
    "to_path": "/path/to/recipient/project",
    "title": "Project Update",
    "content": "The new feature is ready for review."
  }
}
```

### Checking Mailbox
```json
{
  "name": "check_mailbox",
  "arguments": {
    "from_path": "/path/to/my/project",
    "limit": 10
  }
}
```

## Database

The server uses SQLite for data storage:
- **Location**: `~/.communication-server/default/data/communication.db`
- **Features**: Automatic migrations, indexing, optimization
- **Isolation**: Each server instance uses its own database

## Configuration

### Environment Variables
- `NODE_ENV`: Set to "production" for production mode
- `DEBUG`: Enable debug logging
- `MCP_SERVER_ID`: Custom server identifier
- `DATABASE_PATH`: Custom database path

### Server Features
- **Process Detection**: Prevents multiple instances
- **Graceful Shutdown**: Clean shutdown on SIGINT/SIGTERM
- **Performance Monitoring**: Request tracking and statistics
- **Rate Limiting**: Prevents abuse
- **Caching**: Improves response times for read operations

## Development

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd communication-server

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Testing
```bash
# Test the server
npm test

# Quick test
npm run test-quick
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure write permissions to `~/.communication-server/`
   - Check for conflicting server instances

2. **Port Conflicts**
   - The server uses stdio transport, so no port conflicts
   - Multiple instances can run simultaneously with unique IDs

3. **Permission Issues**
   - Ensure Node.js has permission to create database files
   - Check file system permissions

### Logs
The server provides detailed logging:
- Startup information
- Database operations
- Request processing
- Error details

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Repository Issues](https://github.com/minkeymouse/communication-server-mcp/issues)
- Documentation: [README.md](./README.md)
- NPM Package: [communication-server-mcp](https://www.npmjs.com/package/communication-server-mcp)
