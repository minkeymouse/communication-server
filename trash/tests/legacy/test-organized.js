#!/usr/bin/env node

/**
 * Test script for organized Communication Server
 * Tests core functionality after reorganization
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Organized Communication Server...\n');

// Start the server
const server = spawn('node', ['dist/index-simplified.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
let testResults = [];

// Handle server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`📡 Server: ${output.trim()}`);
  
  if (output.includes('MCP server started successfully')) {
    serverReady = true;
    console.log('✅ Server is ready, starting tests...\n');
    setTimeout(runTests, 1000); // Give server a moment to fully initialize
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(`📡 Server: ${output.trim()}`);
  
  if (output.includes('MCP server started successfully')) {
    serverReady = true;
    console.log('✅ Server is ready, starting tests...\n');
    setTimeout(runTests, 1000); // Give server a moment to fully initialize
  }
});

// Test functions
async function runTests() {
  console.log('🔧 Testing Core Tools...\n');
  
  // Test 1: Get Server Health
  await testTool('get_server_health', { random_string: 'test-organized' }, 'Server Health');
  
  // Test 2: List Agents
  await testTool('list_agents', { path: '/data/communication_server/communication-server' }, 'List Agents');
  
  // Test 3: Create Test Agent
  await testTool('create_agent', {
    name: 'Test Agent Organized 2',
    agent_id: 'test-agent-organized-2',
    username: 'testuser2',
    password: 'testpass123',
    role: 'tester',
    capabilities: ['test', 'debug'],
    tags: ['organized', 'test']
  }, 'Create Agent');
  
  // Test 4: Login
  const loginResult = await testTool('login', {
    agent_id: 'test-agent-organized-2',
    username: 'testuser2',
    password: 'testpass123'
  }, 'Login');
  
  if (loginResult.success) {
    const sessionToken = loginResult.data.session_token;
    
    // Test 5: Send Message
    await testTool('send', {
      session_token: sessionToken,
      to_agent: 'comm-server',
      title: 'Test from Organized Server',
      content: 'Testing the organized codebase!',
      priority: 'normal'
    }, 'Send Message');
    
    // Test 6: Check Mailbox
    await testTool('check_mailbox', {
      session_token: sessionToken,
      agent_id: 'test-agent-organized-2',
      limit: 10
    }, 'Check Mailbox');
  }
  
  // Test 7: Get Analytics
  await testTool('get_analytics', {
    time_range: '24h',
    include_details: true
  }, 'Get Analytics');
  
  // Test 8: Get Rate Limit Info
  await testTool('get_rate_limit_info', {
    agent_id: 'test-agent-organized-2'
  }, 'Rate Limit Info');
  
  // Test 9: Get Agent Metrics
  await testTool('get_agent_metrics', {
    agent_id: 'test-agent-organized-2'
  }, 'Agent Metrics');
  
  // Test 10: Get Conversation Threads
  await testTool('get_conversation_threads', {
    agent_id: 'test-agent-organized-2',
    limit: 5
  }, 'Conversation Threads');
  
  // Final health check
  await testTool('get_server_health', { random_string: 'final-test' }, 'Final Health Check');
  
  // Print results
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  testResults.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.name} - ${result.success ? 'PASSED' : 'FAILED'}`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const passedTests = testResults.filter(r => r.success).length;
  const totalTests = testResults.length;
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  // Cleanup
  server.kill();
  process.exit(passedTests === totalTests ? 0 : 1);
}

async function testTool(toolName, args, testName) {
  return new Promise((resolve) => {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    console.log(`🔧 Testing: ${testName}`);
    console.log(`   Tool: ${toolName}`);
    console.log(`   Args: ${JSON.stringify(args)}`);
    
    // Send request to server
    server.stdin.write(JSON.stringify(request) + '\n');
    
    // Wait for response
    const timeout = setTimeout(() => {
      const result = {
        name: testName,
        success: false,
        error: 'Timeout waiting for response'
      };
      testResults.push(result);
      console.log(`   ❌ ${testName}: TIMEOUT\n`);
      resolve(result);
    }, 5000);
    
    const responseHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        clearTimeout(timeout);
        
        if (response.result) {
          const result = {
            name: testName,
            success: true,
            data: response.result
          };
          testResults.push(result);
          console.log(`   ✅ ${testName}: SUCCESS\n`);
          resolve(result);
        } else if (response.error) {
          const result = {
            name: testName,
            success: false,
            error: response.error.message || 'Unknown error'
          };
          testResults.push(result);
          console.log(`   ❌ ${testName}: FAILED - ${result.error}\n`);
          resolve(result);
        }
      } catch (error) {
        // Not a JSON response, ignore
      }
    };
    
    server.stdout.once('data', responseHandler);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.kill();
  process.exit(0);
});

// Wait for server to start
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server failed to start within timeout');
    server.kill();
    process.exit(1);
  }
}, 10000);
