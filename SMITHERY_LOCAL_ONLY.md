# SMITHERY LOCAL-ONLY CONFIGURATION

## ⚠️ IMPORTANT: DO NOT DEPLOY TO CLOUD

This MCP server is designed for **LOCAL INSTALLATION ONLY**.

### Why This Server Cannot Be Deployed to Smithery Cloud:

1. **SQLite Database**: Uses local SQLite database files that cannot be shared across cloud instances
2. **File System Dependencies**: Requires access to local file system for agent workspace paths
3. **Local Agent Communication**: Designed for agents running on the same machine
4. **No Cloud Infrastructure**: No authentication, load balancing, or cloud-specific features

### Correct Usage:

```bash
# Install locally
npm install communication-server-mcp

# Run locally
npx communication-server-mcp

# Use with MCP clients
{
  "mcpServers": {
    "communication-server": {
      "command": "npx",
      "args": ["communication-server-mcp"]
    }
  }
}
```

### Smithery Configuration:

- **Deployment Type**: Local-only
- **Cloud Deployment**: Disabled
- **Scanning**: Disabled
- **Installation**: Via npm registry
- **Usage**: Local MCP client integration

### What Smithery Should Do:

1. ✅ List this server in the registry for discovery
2. ✅ Show npm installation instructions
3. ✅ Display local usage documentation
4. ❌ Do NOT attempt cloud deployment
5. ❌ Do NOT attempt server scanning
6. ❌ Do NOT require test credentials

This server should appear in Smithery as a "local-only" MCP server that users can discover and install locally.
