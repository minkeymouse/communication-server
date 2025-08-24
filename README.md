# Communication Server MCP

**Email-like messaging for AI agents across different projects**

A stable, production-ready MCP server that provides asynchronous communication between AI agents working in different project directories. Now **truly portable** - can be installed and used from anywhere via npm or Smithery.

## 🚀 Quick Start

### Option 1: Automatic Setup (Recommended)

```bash
# Clone and setup automatically
git clone <repository-url>
cd communication-server-mcp
npm run setup
```

This will:
- Build the project
- Update configuration with correct local paths
- Configure Cursor automatically
- Provide next steps

### Option 2: Manual Installation

```bash
# Install dependencies and build
npm install
npm run build

# Run postinstall to update paths
npm run postinstall

# Copy configuration to Cursor
cp mcp_example.json ~/.cursor/mcp.json
```

### Option 3: Smithery Integration

```bash
# Install via Smithery CLI
npx @smithery/cli install communication-server-mcp

# Or run directly with Smithery
npx @smithery/cli run communication-server-mcp --key YOUR_API_KEY --profile YOUR_PROFILE
```

## 🔧 MCP Configuration

The setup process automatically creates three configurations:

1. **`communication-server`**: Use via npx (recommended for production)
2. **`communication-server-dev`**: Use local build (for development)  
3. **`communication-server-smithery`**: Use via Smithery (for distribution)

### How Path Resolution Works

The template configuration uses placeholders that are automatically resolved during installation:

```json
{
  "communication-server-dev": {
    "command": "node",
    "args": ["{{LOCAL_DIST_PATH}}"]  // Automatically replaced with actual path
  }
}
```

The postinstall script automatically:
- Detects the installation directory
- Replaces `{{LOCAL_DIST_PATH}}` with the correct path
- Works on any system, any directory

### Manual Configuration

If you prefer manual setup, copy `mcp_example.json` to `~/.cursor/mcp.json` and choose your preferred configuration:

```json
{
  "mcpServers": {
    "communication-server": {
      "command": "npx",
      "args": ["communication-server-mcp@latest"],
      "transport": "stdio",
      "terminate_on_close": true
    }
  }
}
```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `create_agent` | Create or retrieve an agent for a project |
| `send` | Send messages to other project agents |
| `reply` | Reply to existing messages |
| `check_mailbox` | View recent messages |
| `label_messages` | Change message states |
| `list_messages` | Get message summaries |
| `query_messages` | Search messages |
| `get_server_health` | Check server status |
| `get_unread_count` | Get unread statistics |
| `view_conversation_log` | View conversation history |
| `get_conversation_stats` | Get conversation statistics |

## 📁 Project Structure

```
communication-server/
├── package.json              # NPM package configuration
├── smithery.yaml            # Smithery deployment configuration
├── tsconfig.json            # TypeScript configuration
├── scripts/                 # Setup and installation scripts
│   ├── postinstall.js       # Auto-updates local paths
│   └── setup.js            # Complete setup automation
├── src/                     # Source code
│   ├── index.ts            # Main entry point
│   ├── server.ts           # MCP server implementation
│   ├── database.ts         # Database manager
│   └── models.ts           # TypeScript models
├── dist/                   # Compiled JavaScript (generated)
├── mcp_example.json        # MCP configuration templates
└── README.md               # This file
```

## 🔄 Usage Examples

### From Any Project Directory

```typescript
// Create an agent for the current project
await create_agent({ path: "/current/project/path" });

// Send a message to another project
await send({
  to_path: "/other/project/path",
  title: "API Integration Request",
  content: "Can you help integrate the new endpoints?"
});

// Check mailbox
await check_mailbox({ limit: 10 });
```

### Command Line

```bash
# Start the server locally
npx communication-server-mcp

# Or if installed globally
communication-server-mcp

# Start with Smithery
npx @smithery/cli run communication-server-mcp
```

## 📊 Data Storage

- **Location**: `~/.communication-server/data/`
- **Database**: `communication.db` (SQLite with WAL mode)
- **Logs**: `logs/server.log`
- **Backups**: `backups/`

This ensures the server works from any directory without hardcoded paths.

## 🏗️ Architecture

### Portable Design Principles

1. **Automatic Path Resolution**: Postinstall script updates local paths automatically
2. **Template-Based Configuration**: Uses placeholders that resolve during installation
3. **NPM-based**: Installable via npm for maximum portability
4. **Smithery-ready**: Full integration with Smithery CLI and registry
5. **No Hardcoded Paths**: Uses `os.homedir()` and relative paths
6. **Self-Discovery**: Automatically finds project directories
7. **Portable Data**: Stores data in user's home directory
8. **System Integration**: Available as system-wide command

### Technology Stack

- **TypeScript**: Type-safe development
- **Node.js**: Cross-platform runtime
- **better-sqlite3**: High-performance SQLite
- **@modelcontextprotocol/sdk**: Official MCP SDK
- **Smithery CLI**: Deployment and registry integration

## 🔧 Development

### Building from Source

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

# Test the server
npm test
```

### Smithery Development

```bash
# Start Smithery development mode
npm run smithery:dev

# Deploy to Smithery
npm run smithery:deploy
```

### Adding New Tools

1. **Add to `server.ts`**: Define the tool function
2. **Register with MCP**: Use the request handler
3. **Automatic discovery**: Tools are available immediately

## 🚀 Deployment

### Local Development
```bash
npm install -g .
communication-server-mcp
```

### Global Installation
```bash
npm install -g communication-server-mcp
communication-server-mcp
```

### NPX Usage (Recommended)
```bash
# No installation required - uses npx
npx communication-server-mcp
```

### Smithery Deployment
```bash
# Deploy to Smithery registry
npm run smithery:deploy

# Run via Smithery CLI
npx @smithery/cli run communication-server-mcp
```

### Docker Deployment
```dockerfile
# The server is now portable - no Docker-specific configuration needed
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

## 🔒 Security

- **No hardcoded secrets** - uses environment variables
- **Isolated data storage** - per-user directories
- **MCP security model** - standard protocol security
- **No network exposure** - stdio transport only
- **Smithery authentication** - secure API key management

## 📈 Performance

- **Connection pooling** - efficient database connections
- **Request tracking** - performance monitoring
- **Automatic cleanup** - maintenance scheduling
- **WAL mode** - concurrent database access

## 🆘 Troubleshooting

### Server Not Found
```bash
# Ensure it's available via npx
npx communication-server-mcp

# Or install globally
npm install -g communication-server-mcp

# Check Smithery installation
npx @smithery/cli list
```

### MCP Tools Not Available
- Restart Cursor after configuration changes
- Check `~/.cursor/mcp.json` exists
- Verify server is running: `npx communication-server-mcp`
- Ensure all logs go to stderr (not stdout)

### Data Issues
- Check `~/.communication-server/data/` exists
- Verify permissions on data directory
- Check logs: `~/.communication-server/data/logs/server.log`

### Smithery Issues
- Verify API key and profile are correct
- Check Smithery CLI is up to date: `npm update -g @smithery/cli`
- Ensure server is deployed: `npm run smithery:deploy`

### Setup Issues
- Run `npm run setup` to automatically configure everything
- Ensure you have Node.js 18+ installed
- Check that the build completed successfully

## 🔄 Migration from Previous Versions

If you were using the old Python-based approach:

1. **Uninstall old version**: `pip uninstall communication-server`
2. **Install new version**: `npm install -g communication-server-mcp`
3. **Run setup**: `npm run setup`
4. **Test tools**: Verify they work from any directory

The new npm version is more portable, maintainable, and follows MCP best practices.

## 📦 Publishing

To publish updates to npm:

```bash
# Build the project
npm run build

# Publish to npm
npm publish
```

To deploy to Smithery:

```bash
# Deploy to Smithery registry
npm run smithery:deploy
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**The Communication Server is now truly portable - install it anywhere, use it from any project, and deploy via Smithery!**