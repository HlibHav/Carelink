# Fix Summary: Agent Memory Retrieval Issues

## Problem
The agent wasn't retrieving user name and facts from Weaviate despite the data being stored there.

## Root Causes Identified

### 1. **Query-Based Filtering Removed Name Facts** ⚠️ CRITICAL
- The `filterByQuery` function filtered out facts that didn't match query tokens
- When user said "hello", name facts like "My name is Anna" were filtered out
- **Fixed**: Modified `filterByQuery` to always include high-importance facts and name-related facts

### 2. **Semantic Search Didn't Match Name Facts** ⚠️ CRITICAL  
- Generic queries ("hello", "how are you") didn't semantically match name facts
- Only top 20 results returned, older name facts could be missed
- **Fixed**: Added explicit name fact retrieval with dedicated queries

### 3. **Recent Entries Fallback Too Limited**
- Only returned 50 most recent entries
- Older but important facts (like name) were excluded
- **Fixed**: Increased limit to 100 and added high-importance fact retrieval

## Fixes Implemented

### Fix 1: Enhanced `filterByQuery` Function
**File**: `services/memory-manager/src/index.ts:657-699`

**Changes**:
- Always includes facts with `importance: 'high'`
- Always includes name-related facts (detected by `derivedKey` pattern or text patterns)
- Prioritizes essential facts before query-based filtering
- Ensures name facts are never filtered out

### Fix 2: Explicit Name Fact Retrieval
**File**: `services/memory-manager/src/index.ts:618-672`

**Changes**:
- Added dedicated semantic search for name-related facts
- Added retrieval of high-importance facts
- Added retrieval of recent high-importance facts
- Prioritizes name facts by moving them to the front of the results array

### Fix 3: Increased Recent Entries Limit
**File**: `services/memory-manager/src/index.ts:303`

**Changes**:
- Increased default limit from 50 to 100 entries
- Ensures more facts are available for retrieval

## Testing Recommendations

1. **Test with generic queries**:
   - User says: "Hello"
   - Expected: Name fact should be retrieved and included in context

2. **Test with name queries**:
   - User says: "What's my name?"
   - Expected: Name fact should be retrieved and agent should know the name

3. **Test with old name facts**:
   - Create a name fact, wait, then query with generic text
   - Expected: Name fact should still be retrieved (high-importance facts are always included)

4. **Verify profile name extraction**:
   - Check that profile has name fields populated
   - Verify `extractPreferredName` can find the name

## Next Steps

1. **Monitor logs** for name fact retrieval:
   - Check `[Memory Manager] Error retrieving name facts:` logs
   - Verify name facts are being found

2. **Verify Weaviate data**:
   - Query Weaviate directly to confirm name facts exist
   - Check that facts have `importance: 'high'` or `derivedKey: 'profile:name:*'`

3. **Profile storage verification**:
   - Ensure profile updates include name fields
   - Verify profile structure matches expected format

4. **Consider additional improvements**:
   - Add explicit endpoint to update user profile name
   - Add logging to track name fact retrieval success rate
   - Consider caching name facts in memory for faster access

## Debugging Commands

```bash
# Check Weaviate for name facts
# Use Weaviate GraphQL console:

query {
  Get {
    Memory(
      where: {
        operator: And
        operands: [
          {
            path: ["userId"]
            operator: Equal
            valueString: "YOUR_USER_ID"
          }
          {
            path: ["category"]
            operator: Equal
            valueString: "facts"
          }
        ]
      }
      limit: 100
    ) {
      text
      importance
      metadata
      createdAt
    }
  }
}

# Check user profile
query {
  Get {
    UserProfile(
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "YOUR_USER_ID"
      }
    ) {
      profile
    }
  }
}
```

## Files Modified

1. `services/memory-manager/src/index.ts`
   - Enhanced `filterByQuery` function
   - Added explicit name fact retrieval
   - Increased `fetchRecentEntries` limit

2. `docs/debug-agent-memory-issues.md` (new)
   - Detailed root cause analysis
   - Solution proposals

3. `docs/fix-summary-agent-memory.md` (this file)
   - Summary of fixes applied

