#!/bin/bash
# Start Communication Server with conflict prevention
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Communication Server..."

# Kill any existing instances
echo "🛑 Stopping any existing instances..."
pkill -f "node.*dist/index.js" || true
sleep 2

# Verify no conflicting processes
if pgrep -f "node.*dist/index.js" > /dev/null; then
  echo "❌ Error: Conflicting server still running"
  ps aux | grep "node.*dist/index.js" | grep -v grep
  exit 1
fi

# Generate unique server ID
SERVER_ID="comm-server-$(date +%s)"
echo "📋 Server ID: $SERVER_ID"

# Change to project directory
cd "$PROJECT_DIR"

# Build if needed
if [ ! -f "dist/index.js" ]; then
  echo "🔨 Building project..."
  npm run build
fi

# Start with unique identifier
echo "🚀 Starting server with ID: $SERVER_ID"
export MCP_SERVER_ID="$SERVER_ID"
export NODE_ENV="production"

node dist/index.js
