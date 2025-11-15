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

const TOOL_NAME = 'carelink_dialogue_orchestrator';

const readEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');
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
const agentId = env.ELEVENLABS_AGENT_ID;
const baseUrl =
  (env.ELEVENLABS_BASE_URL?.replace(/\/$/, '') || 'https://api.elevenlabs.io/v1').replace(
    /\/?v1$/,
    '/v1',
  );

if (!apiKey || !agentId) {
  console.error('❌ ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set in the environment or .env');
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

const payload = {
  workflow: {
    client_tools: [clientToolDefinition],
  },
};

const run = async () => {
  const targetUrl = `${baseUrl}/convai/agents/${agentId}`;
  console.log(`➡️  Updating ElevenLabs agent ${agentId.slice(0, 8)}...`);
  const response = await fetch(targetUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`❌ Failed to update agent (${response.status}): ${errorText}`);
    process.exit(1);
  }

  const data = await response.json();
  console.log('✅ ElevenLabs agent workflow updated with CareLink Dialogue Orchestrator client tool.');
  console.log(JSON.stringify(data?.workflow?.client_tools ?? [], null, 2));
};

run().catch((error) => {
  console.error('❌ Unexpected error while updating ElevenLabs agent:', error);
  process.exit(1);
});
