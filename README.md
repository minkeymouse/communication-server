# Communication Server MCP

A stable, production-ready MCP (Model Context Protocol) server that provides email-like messaging capabilities for AI agents working across different projects.

## Features

- **Email-like Messaging**: Familiar messaging patterns for AI agents
- **Project-based Addressing**: Uses workspace paths for agent identification
- **Comprehensive Tooling**: 11 different tools covering all communication needs
- **Production Ready**: Performance monitoring, health checks, proper error handling
- **Portable**: Can be installed and used from anywhere via npm or Smithery

## Quick Start

### Installation

```bash
# Via npm
npm install -g communication-server-mcp

# Via Smithery
npx @smithery/cli install @your-org/communication-server-mcp
```

### Usage

```bash
# Start the server
communication-server-mcp

# Or run directly
node dist/index.js
```

## Tools Available

1. **create_agent** - Create an agent for a project directory (supports custom names and roles)
2. **list_agents** - List all agents in a specific workspace directory
3. **send** - Send messages to other project agents
4. **reply** - Reply to existing messages
5. **check_mailbox** - View recent messages
6. **label_messages** - Change message states
7. **list_messages** - Get message summaries
8. **query_messages** - Search messages
9. **get_server_health** - Check server status
10. **get_unread_count** - Get unread statistics
11. **view_conversation_log** - View conversation history
12. **get_conversation_stats** - Get conversation statistics

## Multi-Agent Support

The communication server now supports multiple agents in the same directory. This allows for more granular agent management:

### Creating Multiple Agents

```bash
# Create a frontend agent
create_agent({
  path: "/project/src",
  name: "Frontend Agent",
  role: "developer"
})

# Create a backend agent in the same directory
create_agent({
  path: "/project/src", 
  name: "Backend Agent",
  role: "developer"
})

# Create a database agent
create_agent({
  path: "/project/src",
  name: "Database Agent", 
  role: "analyst"
})
```

### Listing Agents

```bash
# List all agents in a directory
list_agents({
  path: "/project/src"
})
```

### Agent Naming and Roles

- **Names**: Custom names for better identification (e.g., "Frontend Agent", "API Agent")
- **Roles**: Predefined roles for different responsibilities:
  - `general` - General purpose agent
  - `developer` - Software development tasks
  - `manager` - Project management tasks
  - `analyst` - Data analysis tasks
  - `tester` - Testing and quality assurance
  - `designer` - UI/UX design tasks
  - `coordinator` - Coordination and communication

### Agent ID Generation

Agent IDs are now generated using a combination of:
- Workspace path hash (4 digits)
- Agent name hash (3 digits) 
- Random UUID (8 characters)

This ensures uniqueness while maintaining readability and allowing multiple agents per directory.

## Configuration

The server supports various configuration options:

- **Debug Mode**: Enable detailed logging
- **Database Path**: Custom SQLite database location
- **Max Messages**: Limit message query results
- **Retention Days**: Message cleanup policy

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5+

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/communication-server-mcp.git
cd communication-server-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start development mode
npm run dev
```

### Testing

```bash
# Test MCP protocol
npm run test-mcp

# Test tools
npm run test-tools
```

## Deployment

### Smithery Deployment

This project is configured for easy deployment on Smithery:

1. Push your code to GitHub
2. Connect your repository to Smithery
3. Deploy using the Smithery dashboard

The project includes:
- `smithery.yaml` - Smithery configuration
- `Dockerfile` - Container configuration
- TypeScript runtime support

### Local Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Architecture

- **TypeScript**: Full type safety and modern JavaScript features
- **SQLite**: Lightweight, reliable database with WAL mode
- **MCP SDK**: Official Model Context Protocol implementation
- **Modular Design**: Clean separation of concerns

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/communication-server-mcp/issues)
- **Documentation**: [GitHub Wiki](https://github.com/your-org/communication-server-mcp/wiki)
- **Discord**: [Smithery Community](https://discord.gg/Afd38S5p9A)