# Communication Server MCP

**Clean, organized email-like messaging system for AI agents** with 7 essential tools for agent communication and management. Built with TypeScript, Clean Architecture, and MCP Protocol compliance.

[![npm version](https://img.shields.io/npm/v/communication-server-mcp.svg)](https://www.npmjs.com/package/communication-server-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.11+-green.svg)](https://nodejs.org/)

## 🚀 Features

- **Agent Management**: Create, authenticate, and manage AI agents with identity validation
- **Secure Messaging**: Encrypted communication with multiple security levels
- **Message Templates**: 6 pre-built templates for common use cases
- **Bulk Operations**: Efficient message management and processing
- **Real-time Analytics**: System monitoring and performance metrics
- **Rate Limiting**: Built-in protection against abuse
- **Session Management**: Secure authentication with extended session support (up to 72 hours)
- **Agent Synchronization**: Identity drift detection and ghost agent prevention
- **Conversation Threading**: Organized conversation management with context preservation

## 🏗️ Architecture

Built with **Clean Architecture** principles:

- **Domain Layer**: Pure business logic and models
- **Application Layer**: Use cases and handlers
- **Services Layer**: Business operations and orchestration
- **Infrastructure Layer**: Database, security, and external integrations
- **Shared Layer**: Common utilities, types, and constants

### Modular Design

```
src/
├── application/handlers/     # MCP tool implementations
├── domain/agents/           # Business models and logic
├── infrastructure/          # Database, security, analytics
├── services/               # Business operations
│   ├── agent-monitor/      # Agent monitoring (modular)
│   └── communication/      # Conversation management (modular)
└── shared/                 # Common utilities and types
```

## 📦 Installation

### For Cursor IDE

1. **Install the package globally:**
   ```bash
   sudo npm install -g communication-server-mcp
   ```

2. **Automatic Configuration:**
   
   The package automatically configures Cursor's MCP settings:
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

4. **Verify Installation:**
   
   After restarting Cursor, wait 10-30 seconds for the MCP server to register:
   ```bash
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | communication-server-mcp
   ```
   
   Or run the verification script:
   ```bash
   npm run verify
   ```

### Troubleshooting

**If Cursor doesn't recognize the tools after restart:**
1. Wait 30-60 seconds - MCP servers need time to register
2. Check configuration: `cat ~/.cursor/mcp.json`
3. Verify server: `communication-server-mcp --help`
4. Try restarting Cursor again

**Manual Configuration (if automatic setup fails):**
   
Add to `~/.cursor/mcp.json`:
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

## 🛠️ Available Tools (7 Essential)

### Agent Management
- `create_agent` - Register new agents with validation
- `login` - Authenticate agents with session tokens (up to 72 hours)
- `discover_agents` - List and discover agents with filtering

### Communication
- `communicate` - Send/receive messages, check mailbox, reply
- `manage_messages` - Bulk message operations (mark read, delete)
- `get_templates` - Pre-built message templates for common use cases

### System
- `system_status` - System health, analytics, and performance metrics

## 📋 Usage Examples

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

### Authenticating an Agent
```json
{
  "method": "tools/call",
  "params": {
    "name": "login",
    "arguments": {
      "agent_id": "my-agent",
      "session_minutes": 4320
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

### Getting Message Templates
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_templates",
    "arguments": {
      "template_type": "task_request",
      "include_system_info": true
    }
  }
}
```

## 🔧 CLI Commands

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

## ⚙️ Configuration

### Environment Variables

- `MCP_SERVER_ID` - Unique identifier for the server instance
- `NODE_ENV` - Environment (production/development)
- `DATABASE_PATH` - Custom database path (optional)

### Database

The server automatically creates a SQLite database in:
- Linux/macOS: `~/.communication-server/default/data/communication.db`
- Windows: `%USERPROFILE%\.communication-server\default\data\communication.db`

## 🔒 Security Features

- **Encryption Levels**: none, basic, signed, encrypted
- **Session Management**: Extended sessions up to 72 hours
- **Identity Validation**: Agent identity drift detection
- **Rate Limiting**: Built-in protection against abuse
- **Ghost Agent Prevention**: Detection of interactions with non-existent agents
- **Self-Interaction Prevention**: Detection of agents messaging themselves

## 🏗️ Development

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

### Development Scripts

```bash
npm run build          # Build TypeScript
npm run dev           # Development mode
npm run start         # Production mode
npm run verify        # Verify installation
```

## 📊 Performance & Monitoring

- **Real-time Analytics**: System health and performance metrics
- **Agent Monitoring**: Identity stability and conversation coherence
- **Performance Tracking**: Response times and throughput monitoring
- **Error Tracking**: Comprehensive error logging and analysis

## 📋 Changelog

### [3.3.0] - 2024-12-19

#### 🚀 Major Features
- **Modular Architecture**: Complete refactoring into focused, maintainable modules
- **Agent Synchronization**: Identity drift detection and ghost agent prevention
- **Conversation Threading**: Organized conversation management with context preservation
- **Extended Sessions**: Support for sessions up to 72 hours (4320 minutes)
- **Enhanced Templates**: 6 pre-built templates for common communication scenarios

#### 🔧 Architecture Improvements
- **Clean Architecture**: Implemented proper domain, application, services, infrastructure, and shared layers
- **Modular Services**: 
  - Agent Monitor: Split into `types.ts`, `identity-manager.ts`, `performance-tracker.ts`, `index.ts`
  - Communication: Split into `types.ts`, `context-manager.ts`, `conversation-thread-manager.ts`, `index.ts`
- **Handler Organization**: Broke down large handlers into focused modules
  - System Handler: Reduced from 472 lines to 100 lines (orchestrator)
  - Template Handler: New 80-line focused module
  - Status Handler: New 150-line focused module

#### 🛠️ Technical Enhancements
- **Type Safety**: Consolidated type definitions and improved TypeScript integration
- **Database Consolidation**: Single database manager with enhanced functionality
- **Security Cleanup**: Removed redundant encryption implementations
- **Import Structure**: Fixed all import paths and module resolution

#### 📊 Performance & Quality
- **Code Reduction**: ~25% reduction in total lines of code
- **Redundancy Elimination**: Removed duplicate implementations and consolidated functionality
- **Build Success**: ✅ All TypeScript compilation errors resolved
- **Maintainability**: Smaller files with single responsibilities

### [3.2.0] - 2024-12-18

#### 🚀 Features
- **7 Essential Tools**: Complete MCP tool implementation
- **Agent Management**: Create, authenticate, and manage AI agents
- **Secure Messaging**: Encrypted communication between agents
- **Message Templates**: Pre-built templates for common use cases
- **Bulk Operations**: Efficient message management and processing
- **Analytics**: Real-time system monitoring and performance metrics
- **Rate Limiting**: Built-in protection against abuse
- **Session Management**: Secure authentication and session handling

#### 🔧 Technical
- **TypeScript Implementation**: Full type safety with interfaces and enums
- **SQLite Database**: Persistent storage for messages and agents
- **MCP Protocol**: Model Context Protocol for agent communication
- **Clean Architecture**: Domain, Application, Services, Infrastructure, Shared layers

### [3.1.0] - 2024-12-17

#### 🚀 Initial Release
- **Basic MCP Server**: Model Context Protocol implementation
- **Agent Communication**: Email-like messaging system
- **Database Integration**: SQLite storage for messages and agents
- **Security**: Basic encryption and authentication
- **CLI Tools**: Server management commands

## 🔧 Technical Specifications

### Dependencies
- `@modelcontextprotocol/sdk`: ^1.17.4
- `better-sqlite3`: ^9.4.3
- `uuid`: ^10.0.0

### Node.js Support
- **Engines**: ^20.11.0 || ^20.12.0 || ^20.13.0 || ^20.14.0 || ^20.15.0 || ^20.16.0 || ^20.17.0 || ^20.18.0 || ^22.0.0

### Build Process
- **TypeScript**: Full type safety
- **ES Modules**: Modern JavaScript modules
- **MCP Compliance**: JSON-RPC 2.0 protocol

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- Issues: https://github.com/communication-server/communication-server-mcp/issues
- Documentation: https://github.com/communication-server/communication-server-mcp#readme

---

**Built with ❤️ for the AI agent community**
