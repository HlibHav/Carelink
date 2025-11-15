import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/services/openAIClient', () => {
  return {
    coachModel: 'test-model',
    getOpenAIClient: () => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              { message: { content: JSON.stringify({
                summary: 'test summary',
                focus_domains: ['physical'],
                actions: [{ title: 'test action' }],
                conversation_starters: ['hello']
              }) } },
            ],
          }),
        },
      },
    }),
  };
});

describe('generateCoachPlan', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns structured plan from OpenAI response', async () => {
    const { generateCoachPlan } = await import('../src/orchestrator/planGenerator.js');
    const plan = await generateCoachPlan(
      {
        userId: 'user',
        goals: [],
        openLoops: [],
      },
      {
        userId: 'user',
        turnId: 'turn',
      },
    );

    expect(plan.summary).toBe('test summary');
    expect(plan.focusDomains).toContain('physical');
    expect(plan.actions[0]?.title).toBe('test action');
    expect(plan.conversationStarters[0]).toBe('hello');
  });
});
