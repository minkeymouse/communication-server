# Communication Server MCP

Enhanced email-like messaging for AI agents with cryptographic identification, bulk operations, and account management.

## Features

- **Agent Management**: Create, authenticate, and manage AI agents
- **Secure Messaging**: Encrypted communication between agents
- **Message Templates**: Pre-built templates for common use cases
- **Bulk Operations**: Efficient message management and processing
- **Analytics**: Real-time system monitoring and performance metrics
- **Rate Limiting**: Built-in protection against abuse
- **Session Management**: Secure authentication and session handling

## Installation

### For Cursor IDE

1. **Install the package globally (requires sudo):**
   ```bash
   sudo npm install -g communication-server-mcp
   ```

2. **Automatic Configuration:**
   
   The package automatically configures Cursor's MCP settings. You should see a success message like:
   ```
   ✅ Communication Server MCP automatically configured!
   Configuration file: /home/user/.cursor/mcp.json
   
   Current MCP servers:
   • exa
   • context7-mcp
   • communication-server
   
   🔄 Please restart Cursor to load the new MCP configuration.
   ```

3. **Restart Cursor** to load the new MCP configuration

4. **Verify Installation (Important!):**
   
   After restarting Cursor, wait 10-30 seconds for the MCP server to register, then test:
   ```bash
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | communication-server-mcp
   ```
   
   You should see a JSON response with available tools.
   
   **Or run the verification script:**
   ```bash
   npm run verify
   ```

### Troubleshooting

**If Cursor doesn't recognize the tools after restart:**
1. Wait 30-60 seconds - MCP servers need time to register
2. Check if the configuration was added: `cat ~/.cursor/mcp.json`
3. Verify the server works: `communication-server-mcp --help`
4. Try restarting Cursor again

**Manual Configuration (if automatic setup fails):**
   
Add this to your `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "communication-server": {
      "command": "communication-server-mcp",
      "args": [],
      "env": {
        "MCP_SERVER_ID": "comm-server",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### For Other MCP Clients

The server can be used with any MCP-compatible client. The server runs via stdio and responds to JSON-RPC requests.

## CLI Commands

The package includes CLI commands for server management:

```bash
# Clean server data and logs
communication-server clean

# Stop the server
communication-server stop

# Start the server
communication-server start

# Reinitialize the server
communication-server reinitialize
```

## Available Tools

### Agent Management
- `create_agent` - Register a new agent in the communication system
- `login` - Authenticate an agent and start a session
- `discover_agents` - List and discover agents in the system

### Communication
- `communicate` - Send messages, check mailbox, and manage conversations
- `manage_messages` - Bulk message management operations
- `get_templates` - Get pre-built message templates

### System
- `system_status` - Get comprehensive system health and performance metrics

## Usage Examples

### Creating an Agent
```json
{
  "method": "tools/call",
  "params": {
    "name": "create_agent",
    "arguments": {
      "agent_id": "my-agent",
      "name": "My AI Agent",
      "workspace_path": "/home/user/projects/my-project",
      "role": "developer",
      "description": "AI agent for development tasks",
      "capabilities": ["typescript", "react", "api-development"],
      "tags": ["frontend", "backend"]
    }
  }
}
```

### Sending a Message
```json
{
  "method": "tools/call",
  "params": {
    "name": "communicate",
    "arguments": {
      "action": "send",
      "session_token": "your-session-token",
      "to_agent": "recipient-agent",
      "title": "Task Assignment",
      "content": "Please review the latest changes",
      "priority": "normal",
      "security_level": "basic"
    }
  }
}
```

## Configuration

### Environment Variables

- `MCP_SERVER_ID` - Unique identifier for the server instance
- `NODE_ENV` - Environment (production/development)
- `DATABASE_PATH` - Custom database path (optional)

### Database

The server automatically creates a SQLite database in:
- Linux/macOS: `~/.communication-server/default/data/communication.db`
- Windows: `%USERPROFILE%\.communication-server\default\data\communication.db`

## Security

- All messages are encrypted by default
- Session-based authentication
- Rate limiting to prevent abuse
- No passwords required (ID-based authentication for AI agents)

## Development

### Building from Source

```bash
git clone https://github.com/communication-server/communication-server-mcp.git
cd communication-server-mcp
npm install
npm run build
```

### Testing

```bash
npm test
```

## License

MIT License - see LICENSE file for details.

## Support

- Issues: https://github.com/communication-server/communication-server-mcp/issues
- Documentation: https://github.com/communication-server/communication-server-mcp#readme
