# Agents & Tools Architecture

## Extensible Agent Framework

LifeCompanion uses an **extensible agent architecture** built on Langchain/Langgraph, allowing easy addition of new agents and tools without modifying core orchestration logic.

## Agent Interface

All agents implement a common interface:

```typescript
interface Agent {
  name: string;
  description: string;
  version: string;
  tools?: Tool[];
  
  execute(input: AgentInput, context: AgentContext): Promise<AgentOutput>;
  
  // Optional lifecycle hooks
  onInit?(): Promise<void>;
  onError?(error: Error, context: AgentContext): Promise<void>;
}
```

## Core Agents

### 1. Listener Agent

**Purpose**: First layer of processing - transcribe and extract structured information

**Tools**:
- `transcribe_audio`: OpenAI Whisper STT
- `extract_facts`: Extract factual statements
- `extract_intentions`: Extract user intentions/goals
- `extract_emotions`: Initial emotion detection

**Input**:
```typescript
{
  audioBuffer: Buffer;
  userId: string;
  sessionId: string;
}
```

**Output**:
```typescript
{
  transcript: string;
  facts: Fact[];
  intentions: Intention[];
  emotions: EmotionHint[];
  confidence: number;
}
```

### 2. Emotion Classifier Agent

**Purpose**: Refine emotion detection with temporal tracking

**Tools**:
- `classify_emotion`: LLM-based emotion classification
- `get_emotion_history`: Retrieve recent emotion states
- `track_emotion_trend`: Analyze emotion changes over time

**Input**:
```typescript
{
  transcript: string;
  listenerResult: ListenerOutput;
  userId: string;
}
```

**Output**:
```typescript
{
  primary_emotion: "sadness" | "joy" | "anxiety" | "loneliness" | "calm" | "neutral";
  intensity: "low" | "medium" | "high";
  energy: "low" | "medium" | "high";
  social_need: "wants_connection" | "wants_space" | "wants_guidance" | "unknown";
  trend: "improving" | "stable" | "declining";
  days_in_trend: number;
}
```

### 3. Memory Agent

**Purpose**: Long-term "life facts" manager and profile updates

**Tools**:
- `get_user_profile`: Retrieve user profile
- `update_profile`: Update user profile fields
- `extract_routine_patterns`: Identify routine patterns
- `get_last_mode`: Get last conversation mode
- `get_mood_snapshot`: Get daily mood snapshot

**Input**:
```typescript
{
  userId: string;
  extractedFacts: Fact[];
  conversationContext: ConversationContext;
}
```

**Output**:
```typescript
{
  profile: UserProfile;
  routines: Routine[];
  lastMode: string;
  moodSnapshot: MoodSnapshot;
}
```

### 4. Context Engineering Agent

**Purpose**: Agentic context curation - intelligently filter and prioritize memories

**Tools**:
- `filter_by_emotion`: Filter memories by emotional relevance
- `filter_by_mode`: Filter memories by conversation mode
- `filter_by_preferences`: Filter out topics user wants to avoid
- `prioritize_open_loops`: Prioritize medications, appointments
- `rank_by_relevance`: Rank memories by temporal and contextual relevance
- `structure_context`: Create different context structures for Planner vs Coach

**Input**:
```typescript
{
  rawMemories: RawRAGResults;
  emotionState: EmotionState;
  userProfile: UserProfile;
  healthSnapshot: HealthSnapshot;
  lastMode: string;
}
```

**Output**:
```typescript
{
  current_mood: string;
  health_snapshot: string;
  today: { sleep: number; steps: number };
  open_loops: OpenLoop[];
  relationship: RelationshipContext;
  selected_memories: {
    facts: Fact[];
    goals: Goal[];
    gratitude: GratitudeEntry[];
  };
  context_for_planner: string;
  context_for_coach: string;
}
```

### 5. Planner Agent

**Purpose**: Decide interaction strategy (mode and goal)

**Tools**:
- `evaluate_emotion_state`: Analyze emotion state for mode selection
- `check_open_loops`: Check for urgent reminders/appointments
- `assess_user_readiness`: Assess if user is ready for coaching
- `select_mode`: Choose appropriate mode
- `formulate_goal`: Create interaction goal

**Input**:
```typescript
{
  lastEmotion: EmotionState;
  lastMode: string;
  emotionState: EmotionState;
  userProfile: UserProfile;
  openLoops: OpenLoop[];
  curatedContext: CuratedContext;
}
```

**Output**:
```typescript
{
  mode: "coach" | "support" | "gratitude" | "game" | "reminder";
  goal: "clarify_feelings" | "set_tiny_step" | "reflect" | "cheer_up" | "ask_gratitude" | ...;
  coachIntensity: "low" | "medium" | "high";
  reasoning: string;
}
```

### 6. Coach/Companion Agent

**Purpose**: Generate natural language response with coaching skillset

**Tools**:
- `generate_reply`: Main LLM call for response generation
- `apply_coaching_technique`: Apply specific coaching technique (GROW, reframing, etc.)
- `suggest_micro_goal`: Suggest tiny habit/micro-goal
- `normalize_emotion`: Provide emotional normalization
- `extract_coaching_actions`: Extract actions (set goal, log gratitude, etc.)

**Input**:
```typescript
{
  transcript: string;
  emotionState: EmotionState;
  mode: string;
  goal: string;
  userProfile: UserProfile;
  memories: Memory[];
  contextSnapshot: CuratedContext;
}
```

**Output**:
```typescript
{
  replyText: string;
  coachingActions?: {
    type: "set_goal" | "update_goal" | "log_gratitude" | "log_mood" | "none";
    payload: any;
  };
  techniquesUsed: string[];
}
```

### 7. Tone Selector Agent

**Purpose**: Map emotion/mode to ElevenLabs voice parameters

**Tools**:
- `select_tone_mode`: Choose from 8-mode tonal map
- `get_tone_parameters`: Get stability/similarity/style ranges
- `generate_tone_instruction`: Generate Ukrainian tone instruction text

**Input**:
```typescript
{
  emotionState: EmotionState;
  mode: string;
  coachIntensity: string;
  userProfile: UserProfile;
}
```

**Output**:
```typescript
{
  stability: number | [number, number];
  similarityBoost: number | [number, number];
  style: "soft" | "conversational" | "serious" | "excited" | "emotional" | "narration";
  toneInstruction: string;
}
```

## Tool System

### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any, context: ToolContext) => Promise<any>;
  required?: boolean;
  category?: "memory" | "emotion" | "health" | "communication" | "general";
}
```

### Tool Categories

#### Memory Tools
- `get_user_profile(userId)`: Retrieve user profile
- `get_memories(userId, category, limit)`: Get memories by category
- `search_memories(userId, query, topK)`: Semantic search memories
- `save_fact(userId, fact)`: Save new fact
- `save_goal(userId, goal)`: Save new goal
- `save_gratitude(userId, entry)`: Save gratitude entry
- `update_mood_snapshot(userId, day, snapshot)`: Update mood snapshot

#### Emotion Tools
- `classify_emotion(text, audioFeatures?)`: Classify emotion from text
- `get_emotion_history(userId, days)`: Get emotion history
- `track_emotion_trend(userId)`: Analyze emotion trends
- `detect_emotion_change(userId)`: Detect significant emotion changes

#### Health Tools
- `get_health_snapshot(userId)`: Get today's health metrics
- `get_sleep_data(userId, days)`: Get sleep data
- `get_activity_data(userId, days)`: Get activity/steps data
- `analyze_health_trends(userId)`: Analyze health trends
- `suggest_health_action(userId, healthData)`: Suggest health actions

#### Communication Tools
- `generate_reply(context)`: Generate conversational reply
- `apply_coaching_technique(technique, context)`: Apply coaching technique
- `select_tone(emotion, mode)`: Select voice tone
- `format_response(text, tone)`: Format response for TTS

#### General Tools
- `get_current_time()`: Get current time/date
- `check_reminders(userId)`: Check pending reminders
- `create_reminder(userId, reminder)`: Create new reminder
- `get_ritual_content(userId, type)`: Get ritual content (morning/evening/weekly)

## Adding New Agents

### Step 1: Create Agent Class

```typescript
import { Agent, AgentInput, AgentOutput, AgentContext } from './agent-framework';

export class CustomAgent implements Agent {
  name = "custom-agent";
  description = "Custom agent description";
  version = "1.0.0";
  tools = [/* your tools */];

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    // Agent logic
    return {
      success: true,
      data: {/* output data */},
      metadata: {}
    };
  }
}
```

### Step 2: Register Agent

```typescript
// In orchestrator setup
import { CustomAgent } from './agents/custom-agent';
import { AgentRegistry } from './agent-registry';

AgentRegistry.register(new CustomAgent());
```

### Step 3: Add to Orchestration Graph

```typescript
// In Langgraph setup
const graph = new StateGraph(ConversationState)
  .addNode("listener", listenerAgent.execute)
  .addNode("emotion", emotionAgent.execute)
  // ... existing nodes
  .addNode("custom", customAgent.execute) // New agent
  .addEdge("previous_node", "custom")
  .addEdge("custom", "next_node");
```

## Adding New Tools

### Step 1: Create Tool

```typescript
import { Tool } from './tool-framework';

export const customTool: Tool = {
  name: "custom_tool",
  description: "Tool description",
  parameters: {
    type: "object",
    properties: {
      param1: { type: "string" },
      param2: { type: "number" }
    },
    required: ["param1"]
  },
  category: "general",
  async execute(params, context) {
    // Tool logic
    return { result: "..." };
  }
};
```

### Step 2: Register Tool

```typescript
// In agent class
import { ToolRegistry } from './tool-registry';

export class MyAgent implements Agent {
  tools = [
    ToolRegistry.get("existing_tool"),
    customTool // New tool
  ];
}
```

## Agent Registry Pattern

```typescript
class AgentRegistry {
  private static agents: Map<string, Agent> = new Map();

  static register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  static get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  static getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  static getByCategory(category: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.category === category);
  }
}
```

## Tool Registry Pattern

```typescript
class ToolRegistry {
  private static tools: Map<string, Tool> = new Map();

  static register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  static get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  static getByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.category === category);
  }
}
```

## Future Agent Examples

### Health Monitoring Agent
- Monitors health trends
- Suggests interventions
- Tools: health analysis, trend detection, intervention suggestions

### Social Connection Agent
- Facilitates social interactions
- Suggests social activities
- Tools: contact management, activity suggestions

### Cognitive Training Agent
- Manages memory games
- Adapts difficulty
- Tools: game generation, difficulty adjustment, progress tracking

### Proactive Engagement Agent
- Initiates conversations
- Schedules check-ins
- Tools: time-based triggers, conversation initiation, scheduling

## Best Practices

1. **Agent Independence**: Agents should be independent and testable in isolation
2. **Tool Reusability**: Tools should be reusable across agents
3. **Clear Interfaces**: Well-defined input/output contracts
4. **Error Handling**: Agents should handle errors gracefully
5. **Observability**: All agent actions should be logged to Phoenix
6. **Versioning**: Agents and tools should be versioned
7. **Documentation**: Each agent/tool should have clear documentation

