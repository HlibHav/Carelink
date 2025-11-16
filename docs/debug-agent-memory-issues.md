# Debug: Why Agent Doesn't Know User Name and Facts

## Problem Analysis

The agent should know the user's name and facts from Weaviate, but it's not using them. Here are the identified issues:

## Issue 1: Profile Name Not Explicitly Passed to Coach Agent

**Location**: `agents/dialogue/src/orchestrator/coachAgent.ts`

**Problem**: 
- The `directives` object contains `preferredName` and `identityFacts`
- But the coach agent prompt doesn't explicitly tell the model WHERE to find these in the JSON structure
- The prompt just says "Mention the user's preferred name if it's available" but doesn't point to `directives.preferredName`

**Current code**:
```typescript
const instructions = {
  transcript: input.listener.transcript,
  summary: input.listener.summary,
  emotion: input.emotion,
  plan: input.plan,
  context_blocks: contextBlocks,
  directives: input.directives,  // preferredName is here but not highlighted
};
```

## Issue 2: Semantic Search May Not Retrieve Old Facts

**Location**: `services/memory-manager/src/index.ts` (line 599-607)

**Problem**:
- When semantic search returns empty results, it falls back to `fetchRecentEntries(userId, 'facts')`
- This only gets the 50 most recent entries sorted by `createdAt DESC`
- If name/facts were stored weeks ago, they won't be in the top 50
- No fallback to search for high-importance facts or facts containing name keywords

**Current code**:
```typescript
if (!facts.length) {
  facts = await fetchRecentEntries(userId, 'facts');  // Only recent 50!
}
```

## Issue 3: Profile May Not Be Stored with Name Fields

**Location**: `services/memory-manager/src/index.ts` (line 79-135)

**Problem**:
- Profile is stored as JSON string in UserProfile collection
- Need to verify that `preferredName`, `name`, `fullName` fields are actually being stored
- The `extractPreferredName` function looks for multiple field names, but if none exist in the stored profile, it returns undefined

## Issue 4: Facts Not Prioritized by Importance

**Location**: `services/memory-manager/src/index.ts` (line 303-353)

**Problem**:
- `fetchRecentEntries` only sorts by `createdAt DESC`
- Doesn't prioritize high-importance facts
- Doesn't search for facts containing name-related keywords

## Issue 5: Coach Agent Doesn't Explicitly Use Directives

**Location**: `agents/dialogue/src/orchestrator/coachAgent.ts`

**Problem**:
- The system prompt mentions using preferred name, but doesn't explicitly reference `directives.preferredName`
- The `identityFacts` from directives aren't explicitly mentioned in the prompt
- The model might not realize these are the most important facts to use

## Solutions Implemented

### ✅ Fix 1: Coach Agent Now Explicitly Highlights Name and Identity Facts

**File**: `agents/dialogue/src/orchestrator/coachAgent.ts`

**Changes**:
- Added explicit `IMPORTANT` sections at the top of context blocks for:
  - User's preferred name with instruction to ALWAYS use it
  - Identity facts with instruction to use them to make user feel seen
- Added personalization note to context blocks

**Impact**: The LLM now sees name and identity facts prominently at the top of the context, making it impossible to miss.

### ✅ Fix 2: Enhanced Memory Retrieval with Priority-Based Fallback

**File**: `services/memory-manager/src/index.ts`

**Changes**:
- Added `fetchHighImportanceFacts()` function to retrieve medium+ importance facts
- Added `searchFactsByNameKeywords()` function to search for name-related facts
- Enhanced fallback logic:
  - When semantic search returns empty, now fetches high-importance facts FIRST
  - Then combines with recent facts, prioritizing high-importance
  - When no query provided, fetches high-importance facts first
  - After profile is loaded, searches for name-related facts if preferredName exists

**Impact**: Even if facts are old, high-importance facts (like name facts) will be retrieved. Name-related facts are actively searched for.

### ✅ Fix 3: Added extractPreferredName Helper

**File**: `services/memory-manager/src/index.ts`

**Changes**:
- Added `extractPreferredName()` function to extract name from profile
- Supports multiple field names: `preferredName`, `preferred_name`, `name`, `fullName`, `full_name`
- Also checks `demographics.nickname`, `demographics.first_name`, `demographics.given_name`

**Impact**: Ensures name can be extracted from profile regardless of which field it's stored in.

## Testing Recommendations

1. **Check Weaviate Data**:
   ```bash
   # Query UserProfile to see if name is stored
   # Query Memory collection for facts with importance='high' or 'medium'
   ```

2. **Test Memory Retrieval**:
   - Call `/memory/{userId}/retrieve-for-dialogue` with empty query
   - Verify high-importance facts are returned
   - Verify name-related facts are included if preferredName exists

3. **Test Coach Agent**:
   - Check logs to see if name and identityFacts appear in context blocks
   - Verify LLM responses include the user's name

## Remaining Potential Issues

1. **Profile Not Stored**: If profile doesn't have name fields, `extractPreferredName` will return undefined
   - **Solution**: Ensure when facts are stored that include name, also update UserProfile with name fields

2. **Facts Not Marked High Importance**: If name facts are stored with `importance='low'`, they might not be prioritized
   - **Solution**: When storing name facts (like in `ensureDerivedFacts`), mark them as `importance='medium'` or `'high'`

3. **Semantic Search Not Matching**: If the query doesn't semantically match stored facts, they won't be retrieved
   - **Solution**: The enhanced fallback now addresses this by prioritizing high-importance facts regardless of query match

