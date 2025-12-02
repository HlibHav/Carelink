# Prompt Optimization Summary

## Current State Analysis

### Token Usage
- **Coach Agent**: 2,391 tokens/request (2,231 prompt + 160 completion)
  - System prompt: ~1,000 tokens (partially cached)
  - User message: ~1,200 tokens (large JSON payload)
- **Mode Planner**: 1,560 tokens/request (1,549 prompt + 11 completion)
  - System prompt: ~500 tokens (not cached)
  - User message: ~1,000 tokens (full state objects)

### Key Issues Identified

1. **Massive context duplication**
   - Identity facts repeated 3x in same message
   - Same goals sent multiple times
   - Full physical/mind state objects when summaries exist

2. **No prompt caching on Mode Planner**
   - System prompt could be cached, saving ~500 tokens/request

3. **Verbose JSON structures**
   - Full nested objects sent when flattened summaries would work
   - Metadata fields (timestamps, IDs) that don't affect response

4. **Redundant system prompts**
   - Full LifeCompanion system prompt + Coach agent prompt
   - Privacy policy repeated in multiple places
   - Mode instructions could be more concise

5. **Inefficient context formatting**
   - Multi-line blocks with headers vs. compact key-value pairs
   - Sending 8 facts when 3 would suffice
   - Sending 3 goals when 1 is usually enough

## Top 5 Optimizations (High Impact, Quick Wins)

### 1. Enable Prompt Caching ⚡
**Impact**: 30-50% token reduction on system prompts
**Effort**: 5 minutes
**Change**: Add `cache: true` to OpenAI API calls

### 2. Deduplicate Context Data ⚡
**Impact**: 40-60% reduction in context size
**Effort**: 30 minutes
**Change**: Remove duplicate facts, consolidate identity information

### 3. Compress Health/State Summaries ⚡
**Impact**: 60-80% reduction in state data
**Effort**: 1 hour
**Change**: Use existing summaries instead of full objects, limit arrays

### 4. Reduce Array Limits ⚡
**Impact**: 30-40% reduction in context
**Effort**: 15 minutes
**Change**: 8 facts → 3, 3 goals → 1, 5 vitals → 2

### 5. Compact Context Format ⚡
**Impact**: 20-30% reduction
**Effort**: 30 minutes
**Change**: Use pipe separators, shorter labels, remove headers

## Expected Results

### Before Optimization
- Coach Agent: **2,391 tokens** ($0.0024/request at gpt-4o-mini)
- Mode Planner: **1,560 tokens** ($0.0016/request)
- **Total per turn: 3,951 tokens** ($0.0040/request)

### After Optimization (Conservative)
- Coach Agent: **~1,000 tokens** (58% reduction)
- Mode Planner: **~500 tokens** (68% reduction)
- **Total per turn: ~1,500 tokens** (62% reduction)

### Cost Savings
- At 100K requests/month:
  - Before: **$400/month**
  - After: **$152/month**
  - **Savings: $248/month ($2,976/year)**

- At 1M requests/month:
  - Before: **$4,000/month**
  - After: **$1,520/month**
  - **Savings: $2,480/month ($29,760/year)**

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
- [ ] Enable prompt caching
- [ ] Reduce array slice limits
- [ ] Remove duplicate facts
- [ ] **Expected savings: 40-50%**

### Phase 2: Context Compression (Week 2)
- [ ] Compress health summaries
- [ ] Compress mind/behavior summaries
- [ ] Compact context block format
- [ ] **Expected additional savings: 20-30%**

### Phase 3: Prompt Optimization (Week 3)
- [ ] Create compressed prompt versions
- [ ] Remove redundant instructions
- [ ] A/B test quality
- [ ] **Expected additional savings: 10-15%**

## Risk Mitigation

### Quality Assurance
1. **A/B Testing**: Compare optimized vs. original responses
2. **Monitor Metrics**: Track user satisfaction, error rates
3. **Feature Flags**: Easy rollback if quality degrades
4. **Gradual Rollout**: Start with 10% traffic, increase gradually

### Response Quality Checks
- ✅ Personalization still works (name, facts mentioned)
- ✅ Emotional responses appropriate
- ✅ Health recommendations accurate
- ✅ Mode selection still correct

## Monitoring Dashboard

Track these metrics post-optimization:

```
Token Usage:
- Average tokens per request (by agent)
- Cache hit rate
- Token distribution (system vs user vs completion)

Cost:
- Cost per request
- Daily/weekly/monthly spend
- Cost per user

Quality:
- Response time (should improve)
- Error rate (should stay same)
- User satisfaction (should stay same)
```

## Next Steps

1. **Review** this optimization plan with your team
2. **Prioritize** based on your current traffic and costs
3. **Implement** Phase 1 quick wins first
4. **Monitor** metrics for 1 week before Phase 2
5. **Iterate** based on results

## Files to Modify

### High Priority
- `agents/dialogue/src/orchestrator/coachAgent.ts` - Context compression
- `agents/dialogue/src/orchestrator/plannerAgent.ts` - Input compression, caching

### Medium Priority
- `prompts/system-life-companion.md` - Create compressed version
- `prompts/agent-coach.md` - Create compressed version

### Low Priority
- Create helper utilities for compression
- Add compression configuration

## Questions?

- See `prompt-optimization-guide.md` for detailed analysis
- See `prompt-optimization-implementation.md` for code examples
- Test changes in staging before production
- Monitor Phoenix traces to verify improvements

