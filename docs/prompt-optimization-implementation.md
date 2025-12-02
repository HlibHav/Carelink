# Prompt Optimization Implementation

## Quick Wins - Code Changes

### 1. Enable Prompt Caching

**File: `agents/dialogue/src/orchestrator/coachAgent.ts`**

```typescript
const completion = await client.chat.completions.create({
  model: openAiModels.chat,
  temperature: 0.5,
  max_tokens: 220,
  response_format: { type: 'json_object' },
  messages,
  cache: true, // Add this
});
```

**File: `agents/dialogue/src/orchestrator/plannerAgent.ts`**

```typescript
const completion = await client.chat.completions.create({
  model: openAiModels.planner,
  temperature: 0.2,
  max_tokens: 60,
  response_format: { type: 'json_object' },
  messages,
  cache: true, // Add this
});
```

### 2. Compress Context Blocks

**File: `agents/dialogue/src/orchestrator/coachAgent.ts`**

Replace the contextBlocks building logic:

```typescript
// Helper function to compress health data
function compressHealthSummary(physicalState: PhysicalState | null): string {
  if (!physicalState) return '';
  
  const vitals = physicalState.vitals
    .slice(0, 2) // Only top 2 vitals
    .map(v => {
      const trend = v.trend === 'rising' ? '↑' : v.trend === 'falling' ? '↓' : '→';
      return `${v.label}: ${v.value}${v.unit}${trend} (${v.risk})`;
    })
    .join(', ');
  
  const lifestyle = physicalState.lifestyle
    .slice(0, 1) // Only top lifestyle metric
    .map(l => `${l.label}: ${l.value}${l.unit}`)
    .join(', ');
  
  return vitals ? `${vitals} | ${lifestyle}` : '';
}

function compressMindSummary(mindState: MindBehaviorState | null): string {
  if (!mindState) return '';
  
  return mindState.domains
    .slice(0, 2) // Only top 2 domains
    .map(d => `${d.label}: ${d.status} (${d.score.toFixed(2)})`)
    .join(', ');
}

function deduplicateFacts(facts: string[]): string[] {
  const seen = new Set<string>();
  return facts.filter(fact => {
    const normalized = fact.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Optimized context blocks building
const nameSection = input.directives.preferredName
  ? `Name: "${input.directives.preferredName}"`
  : null;

// Deduplicate identity facts
const identityFacts = deduplicateFacts(input.directives.identityFacts || [])
  .slice(0, 3) // Top 3 only
  .join(', ');

const identityFactsSection = identityFacts ? `Identity: ${identityFacts}` : null;

const contextBlocks = [
  nameSection,
  identityFactsSection,
  input.context.facts.length
    ? `Facts: ${input.context.facts.slice(0, 3).map(f => f.text).join(', ')}`
    : null,
  input.context.goals.length
    ? `Goals: ${input.context.goals.slice(0, 1).map(g => g.text).join(', ')}`
    : null,
  input.context.physicalState
    ? `Health: ${compressHealthSummary(input.context.physicalState)}`
    : null,
  input.context.mindBehaviorState
    ? `Mind: ${compressMindSummary(input.context.mindBehaviorState)}`
    : null,
  input.directives.personalizationNote
    ? `Note: ${input.directives.personalizationNote}`
    : null,
]
  .filter(Boolean)
  .join(' | '); // Use pipe separator instead of newlines

// Simplified instructions object
const instructions = {
  t: input.listener.transcript, // 't' instead of 'transcript'
  e: `${input.emotion.primary} (${input.emotion.intensity})`, // Compressed emotion
  m: input.plan.mode, // 'm' instead of 'mode'
  g: input.plan.goal, // 'g' instead of 'goal'
  ctx: contextBlocks, // 'ctx' instead of 'context_blocks'
};
```

### 3. Optimize Planner Input

**File: `agents/dialogue/src/orchestrator/plannerAgent.ts`**

```typescript
function compressPlannerInput(input: PlannerInput) {
  const emotion = `${input.emotion.primary}/${input.emotion.intensity}/${input.emotion.energy}`;
  
  const goals = input.context.goals
    ?.slice(0, 2) // Top 2 goals only
    .map(g => g.text)
    .join(', ') || '';
  
  const health = input.context.physicalState
    ? input.context.physicalState.summary.slice(0, 50) // First 50 chars
    : '';
  
  const mind = input.context.mindBehaviorState
    ? input.context.mindBehaviorState.summary.slice(0, 50)
    : '';
  
  return {
    e: emotion, // Compressed emotion
    goals: goals || null,
    last: input.context.lastMode,
    health: health || null,
    mind: mind || null,
    time: new Date().toISOString().split('T')[1].slice(0, 5), // Just time, not full ISO
  };
}

// In planNextTurn function:
const messages = [
  { role: 'system', content: plannerPrompt },
  {
    role: 'user',
    content: JSON.stringify(compressPlannerInput(input)),
  },
];
```

### 4. Create Compressed System Prompts

**File: `prompts/system-life-companion-compressed.md`**

```markdown
# LifeCompanion - Core System

**Role**: Warm, voice-first AI companion for older adults.

**Three functions**:
1. Companion: listen, empathize, reflect
2. Coach: gentle guidance, tiny steps  
3. Memory: remember facts, goals, gratitude

**Style**: 5-20s speech, simple, warm, patient.

**Rules**:
- NO medical/legal advice
- NO clinical diagnoses
- NO shaming or pressure
- DO validate feelings
- DO mention known facts when relevant
- DO encourage tiny realistic steps

**Privacy**: Memories stored in CareLink Memory Manager for personalization.
```

**File: `prompts/agent-coach-compressed.md`**

```markdown
# Coach & Companion Agent

**Input**: User utterance, emotion, mode/goal, context summary.

**Output**: JSON with:
- `text`: 1-3 sentences (5-20s speech)
- `reasoning`: optional
- `reminders`: array (0-3 items)
- `proposedActivities`: array (0-2 items)  
- `healthSummary`: object (optional)
- `personalizationNote`: string (optional)

**Modes**:
- support: Reflect feeling, normalize, ask 1 question
- coach: Acknowledge, 1-2 GROW questions, 1 tiny step
- gratitude: Invite 1-3 gratitudes
- game: Light cognitive exercise, playful
- reminder: Gentle mention, ask now/later

**Use user's name if known. Reference true facts from memory.**
```

Then update imports:

```typescript
// In coachAgent.ts
const systemPrompt = `${loadPrompt('system-life-companion-compressed.md')}\n\n${loadPrompt('agent-coach-compressed.md')}`;
```

### 5. Remove Redundant Metadata

**File: `agents/dialogue/src/orchestrator/plannerAgent.ts`**

Remove full objects, send only what's needed:

```typescript
// Before: Sending full physical_state object with all vitals
physical_state: input.context.physicalState

// After: Send only summary
health: input.context.physicalState?.summary || null
```

### 6. Compress JSON Keys

Use shorter keys in JSON payloads:

```typescript
// Create a mapping utility
const COMPRESSED_KEYS = {
  transcript: 't',
  summary: 's',
  emotion: 'e',
  mode: 'm',
  goal: 'g',
  context_blocks: 'ctx',
  primary: 'p',
  intensity: 'i',
  energy: 'e',
  socialNeed: 'sn',
};

function compressKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(compressKeys);
  
  const compressed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const compressedKey = COMPRESSED_KEYS[key] || key;
    compressed[compressedKey] = compressKeys(value);
  }
  return compressed;
}

// Usage
content: JSON.stringify(compressKeys(instructions))
```

**Note**: This makes logs harder to read, so consider only for production or add decompression for logging.

## Implementation Steps

1. **Week 1: Quick Wins**
   - Enable caching
   - Reduce array slice limits
   - Add compression helpers

2. **Week 2: Context Compression**
   - Implement compressHealthSummary
   - Implement compressMindSummary
   - Deduplicate facts

3. **Week 3: Prompt Optimization**
   - Create compressed prompt versions
   - A/B test quality
   - Monitor token usage

4. **Week 4: Advanced**
   - Implement key compression (optional)
   - Add context delta/diffing
   - Fine-tune based on metrics

## Testing Checklist

- [ ] Response quality unchanged (A/B test)
- [ ] Cache hit rate > 50%
- [ ] Token reduction > 50% on average
- [ ] No increase in errors
- [ ] Latency unchanged or improved
- [ ] Personalization still works

## Rollback Plan

Keep original functions commented out:

```typescript
// OLD VERSION - kept for rollback
// const contextBlocks = [ /* old code */ ];

// NEW VERSION
const contextBlocks = [ /* optimized code */ ];
```

Use feature flags:

```typescript
const USE_COMPRESSED_CONTEXT = process.env.USE_COMPRESSED_CONTEXT === 'true';
const contextBlocks = USE_COMPRESSED_CONTEXT 
  ? buildCompressedContext(...)
  : buildOriginalContext(...);
```

