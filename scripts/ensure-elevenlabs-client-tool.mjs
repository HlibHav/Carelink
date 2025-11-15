#!/usr/bin/env node
/**
 * Registers the CareLink Dialogue Orchestrator client tool with an ElevenLabs agent.
 * Requires ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in ../.env or the shell environment.
 *
 * Usage:
 *   node scripts/ensure-elevenlabs-client-tool.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const TOOL_NAME = 'carelink_dialogue_orchestrator';

const readEnvFile = () => {
  // Try .env/.env first (project structure), then .env in root
  const envPath1 = path.resolve(process.cwd(), '.env/.env');
  const envPath2 = path.resolve(process.cwd(), '.env');
  const envPath = fs.existsSync(envPath1) ? envPath1 : envPath2;
  
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf8');
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return acc;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '');
    acc[key] = unquoted;
    return acc;
  }, {});
};

const envFromFile = readEnvFile();
const env = {
  ...envFromFile,
  ...process.env,
};

const apiKey = env.ELEVENLABS_API_KEY;
// Check both ELEVENLABS_AGENT_ID and VITE_ELEVENLABS_AGENT_ID (for frontend compatibility)
const agentId = env.ELEVENLABS_AGENT_ID || env.VITE_ELEVENLABS_AGENT_ID;
const baseUrl =
  (env.ELEVENLABS_BASE_URL?.replace(/\/$/, '') || 'https://api.elevenlabs.io/v1').replace(
    /\/?v1$/,
    '/v1',
  );

if (!apiKey || !agentId) {
  console.error('❌ ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID (or VITE_ELEVENLABS_AGENT_ID) must be set in the environment or .env');
  process.exit(1);
}

const clientToolDefinition = {
  name: TOOL_NAME,
  description:
    'Call this tool to delegate user turns to the CareLink Dialogue Orchestrator and receive a coached response.',
  arguments: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Most recent user transcript or summary of their input.',
      },
      session_id: {
        type: 'string',
        description:
          'CareLink session identifier, if one was provided to the agent via contextual data.',
      },
      user_id: {
        type: 'string',
        description: 'CareLink user identifier, if available.',
      },
      locale: {
        type: 'string',
        description: 'Locale of the user utterance (e.g. en-US).',
      },
    },
    required: ['input'],
  },
};

const run = async () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`🚀 CareLink ElevenLabs Agent Configuration Script`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  // Log configuration
  console.log(`📋 Configuration:`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   API Key: ${apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : 'NOT SET'}`);
  console.log(`   Tool Name: ${TOOL_NAME}\n`);

  // Initialize ElevenLabs client with API key
  console.log(`🔧 Initializing ElevenLabs client...`);
  const client = new ElevenLabsClient({
    apiKey: apiKey,
  });
  console.log(`✅ Client initialized\n`);

  try {
    // First, get the current agent configuration
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`STEP 1: Fetching current agent configuration`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    const getUrl = `${baseUrl}/convai/agents/${agentId}`;
    console.log(`📡 GET Request:`);
    console.log(`   URL: ${getUrl}`);
    console.log(`   Headers: { 'xi-api-key': '${apiKey.slice(0, 10)}...${apiKey.slice(-4)}' }`);
    console.log(`   Method: GET\n`);
    
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey, // API key in header as per ElevenLabs docs
      },
    });

    console.log(`📥 Response Status: ${getResponse.status} ${getResponse.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(getResponse.headers.entries()));

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      console.error(`\n❌ Failed to fetch agent (${getResponse.status}):`);
      console.error(`   Response: ${errorText}`);
      console.error(`\n💡 Troubleshooting:`);
      console.error(`   1. Verify agent ID is correct: ${agentId}`);
      console.error(`   2. Verify API key has "Read" access to "ElevenLabs Agents"`);
      console.error(`   3. Check API status: https://status.elevenlabs.io`);
      process.exit(1);
    }

    const currentAgent = await getResponse.json();
    console.log(`\n✅ Successfully retrieved agent configuration`);
    
    // Debug: show current structure
    console.log(`\n📋 Current agent structure:`);
    console.log(`   Agent ID: ${currentAgent.agent_id || 'N/A'}`);
    console.log(`   Has workflow: ${!!currentAgent.workflow}`);
    console.log(`   Has client_tools: ${!!currentAgent.workflow?.client_tools}`);
    console.log(`   Current client_tools count: ${(currentAgent.workflow?.client_tools || []).length}`);
    
    // Show full workflow structure for debugging
    if (currentAgent.workflow) {
      console.log(`\n   Workflow keys: ${Object.keys(currentAgent.workflow).join(', ')}`);
      console.log(`   Full workflow structure:`);
      console.log(JSON.stringify(currentAgent.workflow, null, 2));
    }
    
    if (currentAgent.workflow?.client_tools?.length > 0) {
      console.log(`\n   Existing client tools:`);
      currentAgent.workflow.client_tools.forEach((tool, idx) => {
        console.log(`     ${idx + 1}. ${tool.name}: ${tool.description?.slice(0, 50)}...`);
      });
    }

    // Check if tool already exists in conversation_config.agent.prompt.tools
    const existingTools = currentAgent.conversation_config?.agent?.prompt?.tools || [];
    const toolExists = existingTools.some((tool) => tool.name === TOOL_NAME && tool.type === 'client');
    
    if (toolExists) {
      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`ℹ️  Client tool "${TOOL_NAME}" already exists!`);
      console.log(`═══════════════════════════════════════════════════════════\n`);
      console.log(`📋 Current client tools:`);
      const clientTools = existingTools.filter((t) => t.type === 'client');
      console.log(JSON.stringify(clientTools, null, 2));
      console.log(`\n✅ No changes needed. Script completed successfully.`);
      return;
    }

    // Update conversation_config.agent.prompt.tools (not workflow.client_tools)
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`STEP 2: Preparing update payload`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    // Add the new client tool to existing tools
    const updatedTools = [
      ...existingTools,
      clientToolDefinition,
    ];
    
    const updatePayload = {
      conversation_config: {
        agent: {
          prompt: {
            tools: updatedTools,
          },
        },
      },
    };
    
    console.log(`📤 Update payload structure:`);
    console.log(`   - conversation_config.agent.prompt.tools: ${updatedTools.length} tool(s)`);
    console.log(`     - Existing: ${existingTools.length}`);
    console.log(`     - New: 1 (${TOOL_NAME})`);
    console.log(`\n📄 Full payload:`);
    console.log(JSON.stringify(updatePayload, null, 2));

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`STEP 3: Updating agent configuration`);
    console.log(`═══════════════════════════════════════════════════════════
`);
    
    const updateUrl = `${baseUrl}/convai/agents/${agentId}`;
    console.log(`📡 PATCH Request:`);
    console.log(`   URL: ${updateUrl}`);
    console.log(`   Headers: {`);
    console.log(`     'Content-Type': 'application/json',`);
    console.log(`     'xi-api-key': '${apiKey.slice(0, 10)}...${apiKey.slice(-4)}'`);
    console.log(`   }`);
    console.log(`   Method: PATCH`);
    console.log(`   Body size: ${JSON.stringify(updatePayload).length} bytes\n`);
    
    const updateResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
        'xi-api-key': apiKey, // API key in header as per ElevenLabs docs
    },
      body: JSON.stringify(updatePayload),
  });

    console.log(`📥 Response Status: ${updateResponse.status} ${updateResponse.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(updateResponse.headers.entries()));

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text().catch(() => 'Unknown error');
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { raw: errorText };
      }
      
      console.error(`\n❌ Failed to update agent (${updateResponse.status}):`);
      console.error(`   Response:`, JSON.stringify(errorJson, null, 2));
      console.error(`\n💡 Troubleshooting:`);
      console.error(`   1. Verify API key has "Write" access to "ElevenLabs Agents"`);
      console.error(`   2. Check agent ID is correct: ${agentId}`);
      console.error(`   3. Verify payload format matches ElevenLabs API requirements`);
      console.error(`   4. Check API status: https://status.elevenlabs.io`);
      console.error(`   5. Try updating agent manually in ElevenLabs dashboard first`);
      process.exit(1);
    }

    const data = await updateResponse.json();
    console.log(`\n✅ Successfully updated agent configuration!`);
    
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`STEP 4: Verification`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
    
    const updatedClientTools = data?.conversation_config?.agent?.prompt?.tools?.filter((t) => t.type === 'client') || [];
    console.log(`📋 Updated client tools (${updatedClientTools.length} total):`);
    console.log(JSON.stringify(updatedClientTools, null, 2));
    
    const updatedTool = updatedClientTools.find((t) => t.name === TOOL_NAME);
    if (updatedTool) {
      console.log(`\n✅ Verification: Tool "${TOOL_NAME}" successfully added!`);
    } else {
      console.log(`\n⚠️  Warning: Tool "${TOOL_NAME}" not found in response (may still be processing)`);
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`✅ Script completed successfully!`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
  } catch (error) {
    console.error(`\n═══════════════════════════════════════════════════════════`);
    console.error(`❌ Unexpected Error`);
    console.error(`═══════════════════════════════════════════════════════════\n`);
    console.error(`Error Type: ${error.constructor.name}`);
    console.error(`Error Message: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack Trace:`);
      console.error(error.stack);
    }
    if (error.cause) {
      console.error(`\nCause:`, error.cause);
    }
    process.exit(1);
  }
};

run().catch((error) => {
  console.error('❌ Unexpected error while updating ElevenLabs agent:', error);
  process.exit(1);
});
