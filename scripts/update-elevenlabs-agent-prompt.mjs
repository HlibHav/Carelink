#!/usr/bin/env node

/**
 * Script to update ElevenLabs agent prompt to use client tools
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readEnvFile = () => {
  const envPath1 = resolve(process.cwd(), '.env/.env');
  const envPath2 = resolve(process.cwd(), '.env');
  const envPath = existsSync(envPath1) ? envPath1 : envPath2;
  
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf8');
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

const env = readEnvFile();
const apiKey = process.env.ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID || env.ELEVENLABS_AGENT_ID || env.VITE_ELEVENLABS_AGENT_ID;

if (!apiKey || !agentId) {
  console.error('❌ Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID');
  process.exit(1);
}

const baseUrl = 'https://api.elevenlabs.io/v1';

// Read the system prompt
const promptPath = resolve(__dirname, '../prompts/system-life-companion.md');
const systemPrompt = readFileSync(promptPath, 'utf8');

// Enhanced prompt with client tool instructions
const enhancedPrompt = `${systemPrompt}

## Client Tool Usage

You have access to a client tool called \`carelink_dialogue_orchestrator\` that connects you to the CareLink Dialogue Orchestrator system.

**IMPORTANT**: For EVERY user message or utterance, you MUST call the \`carelink_dialogue_orchestrator\` tool with:
- \`input\`: The user's current message/transcript
- \`user_id\`: The user identifier (if available)
- \`session_id\`: The conversation session identifier (if available)
- \`locale\`: The user's locale (e.g., "en-US" or "uk-UA")

The tool will return a coached response that you should use as your reply. Always use this tool to generate your responses - do not generate responses directly yourself.

Example tool call:
\`\`\`
carelink_dialogue_orchestrator({
  "input": "Hello, how are you?",
  "user_id": "user_123",
  "session_id": "session_456",
  "locale": "en-US"
})
\`\`\`

The tool response will contain the text you should speak to the user. Use that text as your response.`;

const run = async () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`🚀 Updating ElevenLabs Agent Prompt`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  console.log(`📋 Configuration:`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   API Key: ${apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : 'NOT SET'}\n`);

  try {
    // First, get the current agent configuration
    console.log(`📡 Fetching current agent configuration...`);
    const getResponse = await fetch(`${baseUrl}/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      console.error(`❌ Failed to fetch agent: ${getResponse.status}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }

    const currentAgent = await getResponse.json();
    console.log(`✅ Retrieved agent configuration\n`);

    // Update only the prompt
    const updatePayload = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: enhancedPrompt,
            // Keep existing tools (but not tool_ids to avoid conflict)
            tools: currentAgent.conversation_config?.agent?.prompt?.tools || [],
            llm: currentAgent.conversation_config?.agent?.prompt?.llm || 'gemini-2.5-flash',
            temperature: currentAgent.conversation_config?.agent?.prompt?.temperature ?? 0,
            max_tokens: currentAgent.conversation_config?.agent?.prompt?.max_tokens ?? -1,
          },
        },
      },
    };

    console.log(`📤 Updating agent prompt...`);
    console.log(`   Prompt length: ${enhancedPrompt.length} characters\n`);

    const updateResponse = await fetch(`${baseUrl}/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(updatePayload),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text().catch(() => 'Unknown error');
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { raw: errorText };
      }
      
      console.error(`❌ Failed to update agent (${updateResponse.status}):`);
      console.error(`   Response:`, JSON.stringify(errorJson, null, 2));
      process.exit(1);
    }

    const updatedAgent = await updateResponse.json();
    console.log(`✅ Successfully updated agent prompt!`);
    console.log(`\n📋 Updated prompt preview (first 200 chars):`);
    console.log(`   ${updatedAgent.conversation_config?.agent?.prompt?.prompt?.slice(0, 200)}...`);
    
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`✅ Script completed successfully!`);
    console.log(`═══════════════════════════════════════════════════════════\n`);
  } catch (error) {
    console.error(`\n❌ Unexpected Error:`);
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\nStack Trace:`);
      console.error(error.stack);
    }
    process.exit(1);
  }
};

run();

