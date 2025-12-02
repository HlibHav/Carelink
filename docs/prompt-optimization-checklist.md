# Prompt Optimization Checklist

## 🚀 Quick Wins (Do Today)

### 1. Enable Prompt Caching
- [ ] Add `cache: true` to `coachAgent.ts` API call
- [ ] Add `cache: true` to `plannerAgent.ts` API call
- [ ] Verify cache hit rate in Phoenix traces
- **Expected**: 30-50% reduction in system prompt tokens

### 2. Reduce Array Limits
- [ ] Change `facts.slice(0, 8)` → `facts.slice(0, 3)` in coachAgent.ts
- [ ] Change `goals.slice(0, 3)` → `goals.slice(0, 1)` in coachAgent.ts
- [ ] Change `vitals.slice(0, 3)` → `vitals.slice(0, 2)` in coachAgent.ts
- [ ] Change `domains.slice(0, 3)` → `domains.slice(0, 2)` in coachAgent.ts
- **Expected**: 30-40% reduction in context size

### 3. Remove Duplicate Facts
- [ ] Add deduplication function for identity facts
- [ ] Filter out duplicate facts before joining
- **Expected**: 20-30% reduction in redundant data

## ⚡ Medium Effort (This Week)

### 4. Compress Health Summaries
- [ ] Create `compressHealthSummary()` helper function
- [ ] Use summary text instead of full object for planner
- [ ] Format vitals as "HR: 83↑ (med)" instead of full JSON
- **Expected**: 60-80% reduction in health data size

### 5. Compact Context Format
- [ ] Change multi-line blocks to pipe-separated format
- [ ] Remove section headers ("IMPORTANT Identity Facts:", etc.)
- [ ] Use shorter labels ("Health:" instead of "Physical Summary:")
- **Expected**: 20-30% reduction in formatting overhead

### 6. Remove Metadata Fields
- [ ] Remove `generatedAt`, `createdAt` timestamps
- [ ] Remove `userId` from nested objects (keep in metadata)
- [ ] Remove full metadata objects when only text needed
- **Expected**: 10-15% reduction

## 🎯 Advanced (Next Week)

### 7. Create Compressed Prompts
- [ ] Create `system-life-companion-compressed.md`
- [ ] Create `agent-coach-compressed.md`
- [ ] A/B test quality
- **Expected**: 40-60% reduction in system prompt size

### 8. Context Delta/Diffing
- [ ] Track last sent context
- [ ] Only send changed fields
- **Expected**: 50-70% reduction for repeated calls

## 📊 Verification Steps

After each change:

- [ ] Check token count in Phoenix traces
- [ ] Verify response quality (manual review)
- [ ] Test personalization still works
- [ ] Monitor error rates
- [ ] Check cache hit rate (if applicable)
- [ ] Measure latency impact

## 🎯 Target Metrics

### Token Usage Goals
- Coach Agent: **2,391 → ~1,000 tokens** (58% reduction)
- Mode Planner: **1,560 → ~500 tokens** (68% reduction)
- **Total per turn: 3,951 → ~1,500 tokens** (62% reduction)

### Quality Metrics (Must Maintain)
- Response quality: Same or better
- Personalization: Still working
- Error rate: No increase
- Latency: Same or improved

## 📝 Code Locations

### Files to Modify

**High Priority:**
- `/agents/dialogue/src/orchestrator/coachAgent.ts` - Lines 32-76 (context blocks)
- `/agents/dialogue/src/orchestrator/plannerAgent.ts` - Lines 19-33 (input structure)

**Medium Priority:**
- `/prompts/system-life-companion.md` - Create compressed version
- `/prompts/agent-coach.md` - Create compressed version

**Helper Functions:**
- Create `/agents/dialogue/src/utils/contextCompression.ts`

## 🚨 Rollback Plan

Before deploying:
- [ ] Keep original functions commented out
- [ ] Use feature flag: `USE_COMPRESSED_CONTEXT`
- [ ] Monitor for 24 hours before full rollout
- [ ] Have rollback script ready

## 📚 Reference Docs

- `prompt-optimization-summary.md` - Overview and ROI
- `prompt-optimization-guide.md` - Detailed analysis
- `prompt-optimization-implementation.md` - Code examples

## ✅ Done Checklist

After implementation:
- [ ] All quick wins implemented
- [ ] Medium effort items completed
- [ ] Token reduction verified (>50%)
- [ ] Quality tests passed
- [ ] Monitoring dashboard updated
- [ ] Team documentation updated
- [ ] Cost savings calculated

