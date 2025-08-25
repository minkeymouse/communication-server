#!/bin/bash
# Simple test script that doesn't hang

echo "🧪 Testing Communication Server..."

# Test server health
echo "Testing server health..."
timeout 3s bash -c 'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"get_server_health\",\"arguments\":{\"random_string\":\"test\"}}}" | node dist/index.js' 2>/dev/null | grep -q "healthy" && echo "✅ Server health test passed" || echo "❌ Server health test failed"

# Test agent creation
echo "Testing agent creation..."
timeout 3s bash -c 'echo "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"create_agent\",\"arguments\":{\"agent_id\":\"test-agent-$(date +%s)\",\"name\":\"Test Agent\",\"workspace_path\":\"/data/communication_server/communication-server\",\"role\":\"developer\",\"username\":\"test\",\"password\":\"test\"}}}" | node dist/index.js' 2>/dev/null | grep -q "created" && echo "✅ Agent creation test passed" || echo "❌ Agent creation test failed"

echo "🧪 Testing completed!"
