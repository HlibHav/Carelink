# Prompt Optimization Guide

## Current Token Usage Analysis

Based on your Phoenix traces:

### Coach Agent
- **Prompt tokens**: 2,231 (1,024 cached)
- **Completion tokens**: 160
- **Total tokens**: 2,391

### Mode Planner Agent
- **Prompt tokens**: 1,549 (0 cached)
- **Completion tokens**: 11
- **Total tokens**: 1,560

## Key Optimization Opportunities

### 1. **Enable System Prompt Caching**

OpenAI supports prompt caching for system prompts. Currently, only the Coach Agent shows cached tokens (1,024), but the Mode Planner has 0 cached tokens.

**Implementation:**
```typescript
// In plannerAgent.ts and coachAgent.ts
const completion = await client.chat.completions.create({
  model: openAiModels.planner,
  temperature: 0.2,
  max_tokens: 60,
  response_format: { type: 'json_object' },
  messages,
  cache_control: {
    type: 'ephemeral', // or 'persistent' for longer cache
  },
  cache: true, // Enable caching
});
```

**Expected Savings**: 30-50% reduction on system prompt tokens

### 2. **Compress System Prompts**

Your system prompts contain redundant instructions. Create leaner versions:

**Current Issues:**
- Full system prompt repeated in `system-life-companion.md` + `agent-coach.md`
- Privacy policy repeated in multiple places
- Mode instructions could be referenced, not duplicated

**Optimization:**
```typescript
// Create a compressed version
const SYSTEM_PROMPT_CORE = `You are LifeCompanion: warm, voice-first AI companion.

Core principles:
- Companion: listen, empathize, reflect feelings
- Coach: gentle guidance, tiny steps
- Memory: remember facts, goals, gratitude

Style: 5-20s speech, simple language, warm tone.
Output: JSON with text, reasoning, optional reminders/activities/healthSummary.`;

const MODE_INSTRUCTIONS = {
  support: "Listen, validate, ask one question.",
  coach: "Acknowledge, 1-2 GROW questions, one tiny step.",
  // ... etc
};
```

**Expected Savings**: 40-60% reduction in system prompt size

### 3. **Reduce Context Block Redundancy**

**Current Problems:**
- Same identity facts repeated multiple times
- Full JSON structures when summaries would suffice
- Physical/mind state objects sent fully instead of summaries

**Before:**
```json
{
  "context_blocks": "IMPORTANT Identity Facts:\n- The person accomplished tasks today and is feeling good.\n- The person is in a bad mood today.\n- The person accomplished some tasks today.\n\nProfile: {\"preferences\":{\"tone\":\"warm\"},...}\n\nAdditional Facts:\n- The person accomplished tasks today and is feeling good.\n- The person is in a bad mood today.\n- The person accomplished some tasks today."
}
```

**After:**
```json
{
  "identity": ["accomplished tasks today", "bad mood"],
  "profile": {"tone": "warm"},
  "goals": ["find job"],
  "health": "Activity steady. HR: 83bpm (med). Steps: 6798."
}
```

**Implementation:**
```typescript
// In coachAgent.ts - compress context blocks
const contextBlocks = [
  nameSection,
  input.directives.identityFacts?.slice(0, 3).join(', '), // Deduplicate
  input.context.facts.slice(0, 3).map(f => f.text).join(', '), // Top 3 only
  input.context.goals.slice(0, 2).map(g => g.text).join(', '), // Top 2 only
  formatHealthSummary(input.context.physicalState), // Compressed format
  formatMindSummary(input.context.mindBehaviorState), // Compressed format
]
  .filter(Boolean)
  .join(' | '); // Use separators instead of newlines
```

**Expected Savings**: 50-70% reduction in user message size

### 4. **Simplify JSON Structures**

Instead of sending full nested objects, send flattened summaries:

**Before (Planner):**
```json
{
  "physical_state": {
    "userId": "test-user",
    "generatedAt": "2025-12-02T14:32:26.027Z",
    "summary": "Monitor trends...",
    "vitals": [{...}, {...}, {...}],
    "lifestyle": [{...}, {...}]
  }
}
```

**After:**
```json
{
  "health": "HR: 83bpm↑ (med), Steps: 6798↑, Sleep: 7.9hr",
  "mood": "steady (0.66)"
}
```

**Implementation:**
```typescript
// Create helper functions
function compressPhysicalState(state: PhysicalState | null): string {
  if (!state) return '';
  const topVitals = state.vitals.slice(0, 2)
    .map(v => `${v.label}: ${v.value}${v.unit}${getTrendSymbol(v.trend)} (${v.risk})`)
    .join(', ');
  const lifestyle = state.lifestyle.slice(0, 1)
    .map(l => `${l.label}: ${l.value}${l.unit}`)
    .join(', ');
  return `${topVitals} | ${lifestyle}`;
}

function compressMindBehaviorState(state: MindBehaviorState | null): string {
  if (!state) return '';
  return state.domains.slice(0, 2)
    .map(d => `${d.label}: ${d.status} (${d.score})`)
    .join(', ');
}
```

**Expected Savings**: 60-80% reduction in state data size

### 5. **Use Structured Output Efficiently**

Instead of sending instructions as a large JSON string, structure messages properly:

**Before:**
```typescript
{
  role: 'user',
  content: JSON.stringify({
    transcript: "...",
    emotion: {...},
    plan: {...},
    context_blocks: "...",
    directives: {...},
    memory_policy: {...}
  })
}
```

**After:**
```typescript
// Use multiple user messages for better compression
[
  {
    role: 'user',
    content: `User: "${input.listener.transcript}"
Emotion: ${input.emotion.primary} (${input.emotion.intensity})
Mode: ${input.plan.mode} | Goal: ${input.plan.goal}`
  },
  {
    role: 'user',
    content: `Context: ${compressedContext}`
  }
]
```

**Expected Savings**: 20-30% reduction through better message structure

### 6. **Implement Context Summarization**

For recurring context, create summaries instead of sending full data:

**Implementation:**
```typescript
// Cache and summarize frequently accessed data
const contextSummary = summarizeContext({
  identity: input.directives.identityFacts,
  goals: input.context.goals,
  health: input.context.physicalState,
  // ... only send what changed since last turn
});

// Only send deltas
const contextDelta = getContextDelta(lastContext, currentContext);
```

### 7. **Reduce Prompt Template Size**

**Optimize Markdown Prompts:**

- Remove redundant explanations
- Use abbreviations for common terms
- Consolidate similar instructions
- Use shorter examples

**Before (agent-coach.md):**
```markdown
## Behaviours by Mode

### mode = "support"

- Focus: listening & validation.
- Steps:
  - Reflect the feeling ("Sounds like…").
  - Normalize ("It's okay to feel that way in this situation.").
  - Ask **one** gentle open question or offer to stay with the feeling.
```

**After:**
```markdown
## Modes

support: Reflect feeling ("Sounds like..."), normalize, ask 1 question.
coach: Acknowledge, 1-2 GROW questions, suggest 1 tiny step.
gratitude: Invite 1-3 small gratitudes, warm tone.
game: Light cognitive exercise, playful.
reminder: Gentle mention, ask if now/later, respect "not now".
```

**Expected Savings**: 30-40% reduction in prompt file size

### 8. **Limit Array Sizes More Aggressively**

**Current:**
```typescript
input.context.facts.slice(0, 8)  // 8 facts
input.context.goals.slice(0, 3)  // 3 goals
```

**Optimized:**
```typescript
input.context.facts.slice(0, 3)  // Top 3 most relevant
input.context.goals.slice(0, 1)  // Most important goal only
```

**Reasoning**: For a single turn response, 1-3 most relevant items is usually sufficient.

### 9. **Remove Redundant Metadata**

Remove fields that don't affect the LLM's response:
- `generatedAt` timestamps
- `userId` (can be in metadata)
- Full metadata objects when only text is needed
- `createdAt` dates for goals/reminders

### 10. **Use Fewer-Shot Examples Sparingly**

If you have few-shot examples in prompts, limit to 1-2 most relevant examples instead of multiple.

## Implementation Priority

### High Impact, Low Effort (Do First)
1. ✅ Enable prompt caching
2. ✅ Reduce array slice limits (8→3, 3→1)
3. ✅ Remove redundant metadata fields
4. ✅ Compress health/state summaries

### High Impact, Medium Effort
5. ✅ Compress context blocks format
6. ✅ Create helper functions for state compression
7. ✅ Optimize prompt markdown files

### Medium Impact, High Effort (Do Later)
8. ⏳ Implement context delta/diffing
9. ⏳ Build context summarization cache
10. ⏳ Refactor to multi-message structure

## Expected Overall Savings

With all optimizations:
- **Coach Agent**: 2,391 → ~800-1,000 tokens (60-65% reduction)
- **Mode Planner**: 1,560 → ~400-500 tokens (70-75% reduction)

**Annual Cost Savings**: If you process 1M requests/month:
- Current: ~$500-800/month
- Optimized: ~$150-250/month
- **Savings: $350-550/month or $4,200-6,600/year**

## Monitoring

Track these metrics:
- Token usage per agent
- Cache hit rate
- Response quality (user satisfaction)
- Latency (should improve with smaller prompts)

## Testing

Before deploying:
1. Compare response quality (A/B test)
2. Verify cache hit rates
3. Monitor token usage over time
4. Check for any degradation in personalization

