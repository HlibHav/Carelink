# Memory Nightly Agent Contract

## Overview

The Memory Nightly Agent implements ACE (Agentic Context Engineering) principles to evolve playbooks that guide both retrieval strategies and context engineering rules. It operates as a batch processing service that runs nightly to analyze conversation patterns and improve memory retrieval effectiveness.

## API Endpoints

### POST /nightly/digest/:userId

Generate a daily digest summarizing the day's conversations.

**Request Body** (optional):
```json
{
  "date": "2025-01-15"  // YYYY-MM-DD format, defaults to today
}
```

**Response**:
```json
{
  "userId": "user_123",
  "date": "2025-01-15",
  "highlights": [
    {
      "role": "user",
      "text": "I'm feeling better today",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### POST /nightly/compress/:userId

Compress and consolidate old memories to reduce storage and improve retrieval performance.

**Request Body** (optional):
```json
{
  "olderThanDays": 30,  // Compress memories older than N days
  "dryRun": false       // If true, return what would be compressed without actually doing it
}
```

**Response**:
```json
{
  "status": "completed",
  "jobId": "compress_abc123",
  "compressedCount": 150,
  "retainedCount": 50
}
```

### POST /nightly/evolve-playbook/:userId

Run the ACE (Generation → Reflection → Curation) cycle to evolve the user's playbook.

**Request Body** (optional):
```json
{
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-15"
  },
  "force": false  // If true, run even if playbook was recently updated
}
```

**Response**:
```json
{
  "status": "completed",
  "playbookId": "playbook_xyz789",
  "operations": {
    "added": 5,
    "updated": 2,
    "removed": 1
  },
  "newVersion": 3
}
```

### GET /healthz

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "service": "memory-nightly",
  "time": "2025-01-15T02:00:00Z"
}
```

## Playbook Structure

Playbooks are stored in Firestore at `users/{userId}/playbooks/{playbookId}`:

```typescript
{
  playbookId: string;
  userId: string;
  sections: {
    retrieval_strategies: Array<{
      bulletId: string;           // e.g., "ret-00001"
      condition: string;           // e.g., "emotion=sadness AND mode=support"
      strategy: string;            // e.g., "Prioritize gratitude entries from last 7 days"
      helpful: number;             // Tracking score (incremented when strategy helps)
      harmful: number;              // Tracking score (incremented when strategy harms)
    }>;
    context_engineering_rules: Array<{
      bulletId: string;            // e.g., "ctx-00001"
      rule: string;                 // e.g., "When user mentions family, include related facts even if similarity is lower"
      condition: string;            // e.g., "query contains 'family' OR 'sister' OR 'brother'"
      helpful: number;
      harmful: number;
    }>;
    common_mistakes: Array<{
      bulletId: string;            // e.g., "mistake-00001"
      mistake: string;              // e.g., "Retrieved memories about deceased family member when user was sad"
      correction: string;           // e.g., "Filter out memories about deceased family members when emotion is sadness"
    }>;
  };
  metadata: {
    lastUpdated: string;           // ISO timestamp
    version: number;                // Incremented on each update
  };
}
```

## ACE Cycle

### 1. Generation

Analyze conversation patterns and successful retrieval patterns to generate candidate playbook entries.

**Inputs**:
- Conversation logs with execution traces
- Retrieval logs (which memories were retrieved)
- Usage logs (which memories were actually used in responses)

**Outputs**:
- Candidate retrieval strategies
- Candidate context engineering rules
- Identified patterns

### 2. Reflection

Analyze execution feedback to identify what went wrong or right.

**Inputs**:
- Conversation outcomes (user engagement patterns)
- Retrieval effectiveness metrics
- Explicit feedback signals (if available)
- Current playbook entries used during conversations

**Outputs**:
- Error identification
- Root cause analysis
- Correct approach suggestions
- Bullet tags (helpful/harmful/neutral) for existing playbook entries

### 3. Curation

Incrementally update playbooks based on reflection output.

**Inputs**:
- Current playbook
- Reflection analysis
- Candidate entries from generation

**Outputs**:
- Playbook operations (ADD/UPDATE/REMOVE)
- Updated helpful/harmful scores
- New playbook version

## Execution Feedback Signals

The nightly agent uses multiple feedback signals:

1. **Conversation Outcomes**: User engagement patterns inferred from conversation flow (e.g., user continues conversation vs. ends abruptly)
2. **Retrieval Effectiveness**: Which memories were retrieved vs. actually used in successful responses
3. **Explicit Feedback**: Direct feedback signals from the dialogue orchestrator or user (if available)
4. **Pattern Analysis**: Long-term patterns across multiple conversations

## Scheduling

- **Local Development**: Uses `node-cron` with configurable schedule (default: `0 2 * * *` - 2 AM daily)
- **Production**: Cloud Scheduler triggers HTTP endpoints or Pub/Sub messages

## Configuration

Environment variables:

- `PORT` - Server port (default: 4104)
- `GOOGLE_PROJECT_ID` - Google Cloud project ID
- `FIRESTORE_EMULATOR_HOST` - Firestore emulator host (for local development)
- `NIGHTLY_SCHEDULE_CRON` - Cron expression for scheduled jobs (default: `0 2 * * *`)
- `NIGHTLY_ENABLED` - Boolean flag to enable/disable nightly jobs (default: `true`)
- `OPENAI_API_KEY` - OpenAI API key for LLM-based generation/reflection/curation

