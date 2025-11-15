# LifeCompanion Backend API Reference

Complete API documentation with curl examples and request/response samples.

## Base URL

- **Local Development**: `http://localhost:8080`
- **Production**: `https://api.lifecompanion.app` (TBD)

## Authentication

All `/api/*` endpoints require the following headers:

| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Authorization` | Yes | Bearer token (currently not validated, any value accepted) | `Bearer test-token` |
| `X-User-Id` | Yes | Stable user identifier | `user_123` |
| `X-Device-Id` | Yes | Client-generated device identifier | `device_abc456` |
| `X-Client-Version` | No | Semantic version for compatibility checks | `1.0.0` |

**Note**: The `/healthz` endpoint does not require authentication.

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "retryable": false,
    "details": {
      "additional": "context"
    }
  }
}
```

Common error codes:
- `INVALID_AUTH` (401) - Missing or invalid authentication headers
- `BAD_REQUEST` (400) - Invalid request body or parameters
- `SESSION_NOT_FOUND` (404) - Session ID not found
- `SESSION_ALREADY_ACTIVE` (409) - Device already has an active session
- `INTERNAL_ERROR` (500) - Server error

---

## Endpoints

### Health Check

Check if the service is running.

**Endpoint**: `GET /healthz`

**Authentication**: Not required

**Response**: `200 OK`

```bash
curl http://localhost:8080/healthz
```

**Response Body**:
```json
{
  "status": "ok",
  "time": "2025-01-20T10:30:00.000Z"
}
```

---

### Start Conversation

Creates a new conversational session and returns transport endpoints.

**Endpoint**: `POST /api/start-conversation`

**Authentication**: Required

**Request Headers**:
- `Authorization: Bearer <token>`
- `X-User-Id: <userId>`
- `X-Device-Id: <deviceId>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "locale": "uk-UA",
  "capabilities": {
    "audioFormat": "audio/webm;codecs=opus",
    "supportsText": true,
    "wantsProactiveGreeting": true
  },
  "context": {
    "timezone": "Europe/Kyiv",
    "entryPoint": "daily_ritual"
  }
}
```

**Field Descriptions**:
- `locale` (string, required, min 2 chars) - Locale code (default: `"uk-UA"`)
- `capabilities.audioFormat` (string, required) - Supported audio format
- `capabilities.supportsText` (boolean, optional, default: `true`) - Whether client supports text input
- `capabilities.wantsProactiveGreeting` (boolean, optional, default: `true`) - Whether agent should speak first
- `context.timezone` (string, optional) - User's timezone
- `context.entryPoint` (string, optional) - How the conversation was initiated

**cURL Example**:
```bash
curl -X POST http://localhost:8080/api/start-conversation \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: user_123" \
  -H "X-Device-Id: device_abc456" \
  -H "X-Client-Version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "locale": "uk-UA",
    "capabilities": {
      "audioFormat": "audio/webm;codecs=opus",
      "supportsText": true,
      "wantsProactiveGreeting": true
    },
    "context": {
      "timezone": "Europe/Kyiv",
      "entryPoint": "daily_ritual"
    }
  }'
```

**Success Response**: `201 Created`

```json
{
  "sessionId": "sess_d9f3a7",
  "expiresAt": "2025-01-20T11:30:00.000Z",
  "websocketUrl": "wss://api.lifecompanion.app/ws/conversation?sess=sess_d9f3a7",
  "uploadUrl": "https://api.lifecompanion.app/api/user-utterance",
  "shouldAgentSpeakFirst": true,
  "initialPromptToken": "turn_d9f3a7",
  "iceBreakers": [
    "How did you sleep?",
    "What would feel supportive today?"
  ]
}
```

**Error Responses**:

`401 Unauthorized` - Missing authentication headers:
```json
{
  "error": {
    "code": "INVALID_AUTH",
    "message": "Authorization header is missing or invalid.",
    "retryable": false
  }
}
```

`409 Conflict` - Device already has an active session:
```json
{
  "error": {
    "code": "SESSION_ALREADY_ACTIVE",
    "message": "Session sess_xyz123 already active for this device.",
    "retryable": false
  }
}
```

`400 Bad Request` - Invalid request body:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request body",
    "retryable": false,
    "details": {
      "issues": [
        {
          "code": "invalid_type",
          "expected": "string",
          "received": "undefined",
          "path": ["locale"]
        }
      ]
    }
  }
}
```

---

### User Utterance

Send a user utterance (audio or text) to the orchestrator for processing.

**Endpoint**: `POST /api/user-utterance`

**Authentication**: Required

**Request Headers**:
- `Authorization: Bearer <token>`
- `X-User-Id: <userId>`
- `X-Device-Id: <deviceId>`
- `X-Session-Id: <sessionId>` (required)
- `Content-Type: multipart/form-data` (for audio) or `application/json` (for text only)

**Request Body Options**:

**Option 1: Audio + Metadata (multipart/form-data)**
- `audio` (file, binary) - Audio file (max 10MB)
- `transcript` (string, optional) - Pre-transcribed text
- `metadata` (JSON string or object, optional) - Audio metadata

**Option 2: Text Only (application/json)**
```json
{
  "transcript": "Hello, how are you today?",
  "metadata": {
    "durationMs": 2500,
    "sampleRate": 16000
  }
}
```

**Field Descriptions**:
- `transcript` (string, optional, min 1 char) - User's transcribed text
- `metadata.durationMs` (number, optional, max 40000) - Audio duration in milliseconds
- `metadata.sampleRate` (number, optional) - Audio sample rate in Hz

**Note**: Either `audio` file or `transcript` must be provided.

**cURL Example - Audio Upload**:
```bash
curl -X POST http://localhost:8080/api/user-utterance \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: user_123" \
  -H "X-Device-Id: device_abc456" \
  -H "X-Session-Id: sess_d9f3a7" \
  -F "audio=@/path/to/audio.webm" \
  -F "transcript=Hello, how are you?" \
  -F 'metadata={"durationMs":2500,"sampleRate":16000}'
```

**cURL Example - Text Only**:
```bash
curl -X POST http://localhost:8080/api/user-utterance \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: user_123" \
  -H "X-Device-Id: device_abc456" \
  -H "X-Session-Id: sess_d9f3a7" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Hello, how are you today?",
    "metadata": {
      "durationMs": 2500,
      "sampleRate": 16000
    }
  }'
```

**Success Response**: `200 OK`

The orchestrator runs synchronously and returns the generated reply, metadata, and base64 ElevenLabs audio that the client can play immediately.

```json
{
  "turnId": "turn_550e8400-e29b-41d4-a716-446655440000",
  "transcript": "I felt lonely last night because I couldn't sleep.",
  "listener": {
    "summary": "User is feeling lonely at night due to poor sleep.",
    "facts": [{ "text": "User struggles with sleep", "type": "health" }],
    "intents": ["needs comfort"],
    "emotions": {
      "primary": "sadness",
      "intensity": "medium",
      "energy": "low"
    }
  },
  "emotion": {
    "primary": "sadness",
    "intensity": "medium",
    "energy": "low",
    "socialNeed": "wants_connection"
  },
  "plan": {
    "mode": "support",
    "goal": "reflect_feelings",
    "coachIntensity": "low"
  },
  "coach": {
    "text": "I hear how lonely those nights can feel...",
    "actions": []
  },
  "tone": "warm_empathic",
  "audioBase64": "AAAAGGZ0eXBtcDQyAAAAAGlzb21pc28ybXA...",
  "mimeType": "audio/mpeg"
}
```

**Error Responses**:

`400 Bad Request` - Missing session ID:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Missing X-Session-Id header",
    "retryable": false
  }
}
```

`404 Not Found` - Session not found:
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session sess_invalid not found.",
    "retryable": false
  }
}
```

`400 Bad Request` - Neither audio nor transcript provided:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Either audio or transcript must be provided.",
    "retryable": false
  }
}
```

`400 Bad Request` - Audio duration exceeds limit:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Audio duration exceeds 40 seconds",
    "retryable": false
  }
}
```

---

### Get Session Summary

Retrieve a summary of a conversation session.

**Endpoint**: `GET /api/session-summary?sessionId=<sessionId>`

**Authentication**: Required

**Query Parameters**:
- `sessionId` (string, required) - Session identifier

**cURL Example**:
```bash
curl -X GET "http://localhost:8080/api/session-summary?sessionId=sess_d9f3a7" \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: user_123" \
  -H "X-Device-Id: device_abc456"
```

**Success Response**: `200 OK`

```json
{
  "sessionId": "sess_d9f3a7",
  "userId": "user_123",
  "startedAt": "2025-01-20T10:15:00.000Z",
  "endedAt": "2025-01-20T10:30:00.000Z",
  "moodTrend": "improving",
  "bullets": [
    "Felt calmer after breathing reminder.",
    "Committed to a 5-minute walk after lunch."
  ],
  "capturedGoals": [
    {
      "goalId": "goal_001",
      "text": "Walk after lunch",
      "status": "active"
    }
  ],
  "gratitudeEntries": [
    {
      "entryId": "grat_001",
      "text": "Granddaughter called"
    }
  ]
}
```

**Error Responses**:

`400 Bad Request` - Missing sessionId parameter:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "sessionId query param is required",
    "retryable": false
  }
}
```

---

### Voice Agent (ElevenLabs TTS)

Convert a generated response into playable audio via ElevenLabs.

**Endpoint**: `POST /api/voice-agent/speak`

**Authentication**: Required

**Prerequisite**: set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` on the backend.

**Request Body**

```json
{
  "text": "Let's try a calming breathing exercise together.",
  "tone": "calm_soothing",
  "format": "audio/mpeg"
}
```

- `text` (string, required) – Utterance to be spoken back.
- `tone` (string, optional) – One of `warm_empathic`, `calm_soothing`, `supportive_caring`, `coach_grounded`, `reflective_thoughtful`, `cheerful_light`, `playful_energetic`, `serious_direct`.
- `format` (string, optional) – `audio/mpeg` (default) or `audio/wav`.

**cURL Example**

```bash
curl -X POST http://localhost:8080/api/voice-agent/speak \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: user_123" \
  -H "X-Device-Id: device_abc456" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Let’s try a calming breathing exercise together.",
    "tone": "calm_soothing",
    "format": "audio/mpeg"
  }'
```

**Success Response**: `200 OK`

```json
{
  "tone": "calm_soothing",
  "mimeType": "audio/mpeg",
  "instruction": "Speak slowly and soothingly, easing off at the end of sentences.",
  "voiceSettings": {
    "stability": 0.78,
    "similarity_boost": 0.5,
    "style_preset": "soft"
  },
  "audio": {
    "base64": "<base64-encoded-audio>",
    "dataUri": "data:audio/mpeg;base64,<base64-encoded-audio>"
  }
}
```

The `dataUri` can be plugged into an `<audio>` element, while `base64` is convenient for mobile clients that need manual decoding.

---

## JavaScript/TypeScript Examples

### Using fetch API

```javascript
// Start a conversation
const startConversation = async () => {
  const response = await fetch('http://localhost:8080/api/start-conversation', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
      'X-User-Id': 'user_123',
      'X-Device-Id': 'device_abc456',
      'X-Client-Version': '1.0.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      locale: 'uk-UA',
      capabilities: {
        audioFormat: 'audio/webm;codecs=opus',
        supportsText: true,
        wantsProactiveGreeting: true
      },
      context: {
        timezone: 'Europe/Kyiv',
        entryPoint: 'daily_ritual'
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
};

// Send user utterance (text)
const sendUtterance = async (sessionId, transcript) => {
  const response = await fetch('http://localhost:8080/api/user-utterance', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
      'X-User-Id': 'user_123',
      'X-Device-Id': 'device_abc456',
      'X-Session-Id': sessionId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transcript,
      metadata: {
        durationMs: 2500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
};

// Send user utterance (audio file)
const sendAudioUtterance = async (sessionId, audioFile) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('metadata', JSON.stringify({
    durationMs: 2500,
    sampleRate: 16000
  }));

  const response = await fetch('http://localhost:8080/api/user-utterance', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test-token',
      'X-User-Id': 'user_123',
      'X-Device-Id': 'device_abc456',
      'X-Session-Id': sessionId
      // Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
};
```

---

## Rate Limits

Currently not implemented. Will be added in production.

## WebSocket & SSE Streaming

The response from `/api/user-utterance` includes streaming endpoints:

- **WebSocket**: `wss://api.lifecompanion.app/ws/conversation?sess=<sessionId>`
- **SSE**: `https://api.lifecompanion.app/api/turn-stream?turn=<turnId>`

These endpoints are placeholders and will be implemented in future iterations.
