# ElevenLabs Hosted Agent ↔ CareLink Verification Checklist

This checklist helps verify that the ElevenLabs hosted agent integration with CareLink is working correctly.

## Prerequisites

- [ ] Backend is running and accessible at `VITE_API_URL`
- [ ] ElevenLabs API key is configured (`ELEVENLABS_API_KEY`)
- [ ] ElevenLabs agent ID is configured (`ELEVENLABS_AGENT_ID`)
- [ ] Client tool is registered with the agent (run `node scripts/ensure-elevenlabs-client-tool.mjs`)
- [ ] Frontend is running (`npm run dev`)

## Step 1: Token Fetch Verification

- [ ] Open the frontend application (`http://localhost:5173`)
- [ ] Fill in auth headers (token, user ID, device ID)
- [ ] Check browser console for `[EmbeddedAgentPanel]` logs
- [ ] Verify backend `/api/elevenlabs/agent-config` endpoint is called
- [ ] Confirm conversation token is received and displayed in the UI
- [ ] Check network tab: `GET /api/elevenlabs/agent-config` returns `200` with `{ agentId, conversationToken }`

**Expected logs:**
```
[EmbeddedAgentPanel] Requesting agent config from backend
[EmbeddedAgentPanel] Loaded agent config from backend
```

## Step 2: Microphone Permission

- [ ] Click "Allow Microphone" button (or ensure mic permission is granted)
- [ ] Browser prompts for microphone access
- [ ] Grant permission
- [ ] Verify "Microphone Ready" status appears
- [ ] Check console: `[EmbeddedAgentPanel] Microphone ready`

**Note:** If testing in text-only mode (`VITE_ELEVENLABS_TEXT_ONLY=true`), skip this step.

## Step 3: Agent Connection

- [ ] Click "Connect" button in the ElevenLabs Agents Widget
- [ ] Connection status changes to "Connecting…"
- [ ] Wait for connection to establish
- [ ] Status changes to "Connected"
- [ ] Check console for connection logs:
  ```
  [EmbeddedAgentPanel] Attempting to connect agent
  [EmbeddedAgentPanel] Agent connected
  ```
- [ ] Verify agent panel shows "Connected" status badge

## Step 4: Tool Invocation

- [ ] Speak or type a message to the agent (e.g., "Hello, how are you?")
- [ ] Wait for the agent to process and invoke the client tool
- [ ] Check browser console for client tool logs:
  ```
  [ElevenLabs Client Tool] Tool call initiated
  [API] Sending dialogue turn request
  ```
- [ ] Verify the log includes:
  - Tool call ID
  - Transcript preview
  - Session/user IDs
  - Timestamp

## Step 5: Backend Response

- [ ] Check network tab for `POST /api/elevenlabs/dialogue-turn` request
- [ ] Verify request payload includes:
  - `transcript` (string)
  - `sessionId` (optional string)
  - `userId` (optional string)
  - `metadata.toolCallId` (string)
- [ ] Verify response status is `200 OK`
- [ ] Check response includes:
  - `turnId` (string)
  - `text` (string - the orchestrated response)
  - `emotion` (object)
  - `plan` (object with mode/goal)
  - `tone` (string)
- [ ] Check console for success logs:
  ```
  [API] Dialogue turn response received
  [ElevenLabs Client Tool] Backend response received
  ```
- [ ] Verify logs include:
  - Turn ID
  - Duration (ms)
  - Response length
  - Emotion and mode

## Step 6: Agent Response

- [ ] Verify the agent speaks/returns the orchestrated response
- [ ] Check the agent panel message feed shows:
  - User transcript
  - System message: "Dialogue orchestrator: [response text]"
  - Agent response
- [ ] Verify the response matches what was returned from `/api/elevenlabs/dialogue-turn`

## Step 7: Error Handling

- [ ] Test error scenarios:
  - **Invalid auth**: Remove or invalidate auth token → Should see error logs
  - **Backend down**: Stop backend → Should see connection/request errors
  - **Missing transcript**: Agent invokes tool without input → Should see error
- [ ] Verify error logs appear:
  ```
  [ElevenLabs Client Tool] Backend request failed
  [API] Dialogue turn request failed
  ```
- [ ] Check error logs include:
  - Error message
  - Tool call ID
  - Duration
  - Timestamp

## Step 8: Multiple Turns

- [ ] Send multiple messages to the agent
- [ ] Verify each turn:
  - Generates a unique tool call ID
  - Creates a new turn ID
  - Logs separately in console
  - Appears in network tab as separate requests
- [ ] Check that session ID persists across turns (if provided)

## Troubleshooting

### Client tool not being invoked

- Check that the tool is registered: Run `node scripts/ensure-elevenlabs-client-tool.mjs`
- Verify agent configuration in ElevenLabs dashboard shows `carelink_dialogue_orchestrator` in workflow
- Check browser console for ElevenLabs SDK errors
- Verify agent is actually processing user input (check agent panel message feed)

### Backend not receiving requests

- Verify `VITE_API_URL` points to correct backend
- Check CORS settings on backend
- Verify auth headers are correctly configured
- Check network tab for failed requests and error messages
- Verify backend route `/api/elevenlabs/dialogue-turn` exists and is accessible

### Missing logs

- Ensure browser console is open and not filtered
- Check that `VITE_ELEVENLABS_DEBUG=true` is set (for verbose logs)
- Verify logs aren't being cleared
- Check for console errors that might prevent logging

### Authentication failures

- Verify auth token is valid and not expired
- Check that user ID and device ID match backend expectations
- Verify backend middleware is correctly configured
- Check network tab for `401` or `403` responses

## Success Criteria

✅ All steps above complete without errors  
✅ Client tool invocations appear in console logs  
✅ Backend receives and processes requests  
✅ Agent returns orchestrated responses  
✅ Error handling works correctly  
✅ Multiple turns work as expected  

## Additional Verification

For production readiness:

- [ ] Run integration tests: `npm test`
- [ ] Check telemetry/observability platform for traces (if configured)
- [ ] Verify response times are acceptable (< 5s for dialogue turn)
- [ ] Test with different user IDs and session IDs
- [ ] Verify session persistence across page reloads (if applicable)

