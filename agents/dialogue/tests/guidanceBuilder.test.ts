import { describe, expect, it } from 'vitest';

import { buildResponseGuidance } from '../src/orchestrator/guidanceBuilder.js';
import type { ConversationContext, EmotionState, ListenerResult } from '../src/orchestrator/types.js';

const mockContext: ConversationContext = {
  profile: {
    preferredName: 'Анна',
  },
  facts: [
    {
      id: 'fact_1',
      text: 'Кожного ранку о 9:00 пʼю ліки від тиску',
      category: 'facts',
      importance: 'high',
      metadata: { time: 'ранок' },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'fact_2',
      text: 'Люблю прогулянки з сусідкою Сарою',
      category: 'facts',
      importance: 'medium',
      createdAt: new Date().toISOString(),
    },
  ],
  goals: [
    {
      id: 'goal_1',
      text: 'Щодня 10 хвилин розтяжки',
      category: 'goals',
      importance: 'medium',
      createdAt: new Date().toISOString(),
    },
  ],
  gratitude: [
    {
      id: 'grat_1',
      text: 'Вчора подзвонила онука',
      category: 'gratitude',
      importance: 'medium',
      createdAt: new Date().toISOString(),
    },
  ],
  lastMode: null,
  lastEmotion: null,
  physicalState: {
    userId: 'user_demo',
    generatedAt: new Date().toISOString(),
    summary: 'Vitals look stable.',
    vitals: [
      {
        metric: 'heart_rate',
        label: 'Heart Rate',
        value: 110,
        unit: 'bpm',
        baseline: 80,
        trend: 'rising',
        risk: 'high',
      },
    ],
    lifestyle: [
      {
        metric: 'steps',
        label: 'Steps',
        value: 3200,
        unit: 'count',
        baseline: 5200,
        trend: 'falling',
        risk: 'medium',
      },
    ],
  },
  mindBehaviorState: {
    userId: 'user_demo',
    generatedAt: new Date().toISOString(),
    summary: 'Mind & behavior signals steady.',
    domains: [
      {
        domain: 'social',
        label: 'Соціальний стан',
        score: 0.35,
        status: 'declining',
        description: 'Loneliness rising',
        recommendations: [],
      },
    ],
  },
};

const mockListener: ListenerResult = {
  transcript: 'Можеш нагадати про таблетки і може вийдемо на прогулянку?',
  summary: 'Попросила нагадати про таблетки та прогулянку.',
  facts: [],
  intents: ['walk_reminder'],
  emotions: { primary: 'sadness', intensity: 'medium', energy: 'low' },
};

const mockEmotion: EmotionState = {
  primary: 'sadness',
  intensity: 'medium',
  energy: 'low',
  socialNeed: 'wants_connection',
};

describe('buildResponseGuidance', () => {
  it('detects reminder opportunities from memories', () => {
    const guidance = buildResponseGuidance({
      context: mockContext,
      listener: mockListener,
      emotion: mockEmotion,
    });

    expect(guidance.preferredName).toBe('Анна');
    expect(guidance.reminders.length).toBeGreaterThan(0);
    expect(guidance.reminders[0]?.category).toBe('medication');
  });

  it('summarizes health risks and activity ideas', () => {
    const guidance = buildResponseGuidance({
      context: mockContext,
      listener: mockListener,
      emotion: mockEmotion,
    });

    expect(guidance.healthSummary?.overallRisk).toBe('high');
    expect(guidance.suggestedActivities.some((activity) => activity.category === 'social')).toBe(true);
    expect(guidance.planningCues.length).toBeGreaterThan(0);
  });

  it('injects privacy assurance when the user asks about retention', () => {
    const privacyListener: ListenerResult = {
      ...mockListener,
      transcript: 'Чи зберігаєш ти мою інформацію?',
      summary: 'Запитала про зберігання інформації.',
    };

    const guidance = buildResponseGuidance({
      context: mockContext,
      listener: privacyListener,
      emotion: mockEmotion,
    });

    expect(guidance.privacyAssurance).toBeDefined();
    expect(guidance.privacyAssurance).toContain('Memory Manager');
  });
});
