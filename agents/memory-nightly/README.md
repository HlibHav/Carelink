# Memory Nightly Agent

The Memory Nightly Agent implements ACE (Agentic Context Engineering) principles to evolve playbooks that guide memory retrieval strategies and context engineering rules. It runs as a batch processing service that operates nightly to analyze conversation patterns and improve memory retrieval effectiveness.

## Features

- **Daily Digest Generation**: Summarizes the day's conversations
- **Memory Compression**: Compresses and consolidates old memories
- **ACE Playbook Evolution**: Generation → Reflection → Curation cycle to evolve retrieval strategies

## Architecture

The agent follows the ACE framework:

1. **Generation**: Analyze conversation patterns to generate new playbook insights
2. **Reflection**: Analyze execution feedback to identify what went wrong/right
3. **Curation**: Incrementally update playbooks based on reflection output

## API Endpoints

- `POST /nightly/digest/:userId` - Generate daily digest
- `POST /nightly/compress/:userId` - Compress old memories
- `POST /nightly/evolve-playbook/:userId` - Run ACE cycle
- `GET /healthz` - Health check

See `docs/architecture/memory-nightly-contract.md` for detailed API specifications.

## Configuration

Environment variables:

- `PORT` - Server port (default: 4104)
- `GOOGLE_PROJECT_ID` - Google Cloud project ID
- `FIRESTORE_EMULATOR_HOST` - Firestore emulator host (for local development)
- `NIGHTLY_ENABLED` - Enable/disable nightly jobs (default: `true`)
- `NIGHTLY_SCHEDULE_CRON` - Cron expression for scheduled jobs (default: `0 2 * * *` - 2 AM daily)
- `OPENAI_API_KEY` - OpenAI API key for LLM-based generation/reflection/curation

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Manual Testing

You can trigger nightly jobs manually via HTTP:

```bash
# Generate digest for a user
curl -X POST http://localhost:4104/nightly/digest/user_123 \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-15"}'

# Compress memories
curl -X POST http://localhost:4104/nightly/compress/user_123 \
  -H "Content-Type: application/json" \
  -d '{"olderThanDays": 30, "dryRun": true}'

# Evolve playbook
curl -X POST http://localhost:4104/nightly/evolve-playbook/user_123 \
  -H "Content-Type: application/json" \
  -d '{"dateRange": {"start": "2025-01-01", "end": "2025-01-15"}}'
```

### Scheduling

**Local Development**: Uses `node-cron` with the configured cron expression. Jobs run automatically when the server is running.

**Production**: 
- Option 1: Use Cloud Scheduler to trigger HTTP endpoints
- Option 2: Use Pub/Sub messages to trigger jobs
- Option 3: Keep the cron scheduler running in the deployed service

## Production Deployment Considerations

1. **Scaling**: Consider running nightly jobs in a separate service/container to avoid impacting daytime operations
2. **Error Handling**: Implement retry logic and dead-letter queues for failed jobs
3. **Monitoring**: Add logging and metrics for job execution times and success rates
4. **User Iteration**: In production, iterate over all active users from Firestore rather than hardcoding user IDs

## Related Documentation

- `docs/architecture/memory-nightly-contract.md` - Detailed API contract
- `docs/architecture/carelink_agents.md` - Agent architecture overview
- `docs/memory.md` - Memory system documentation

