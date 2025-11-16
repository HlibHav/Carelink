import type { MemoryEntry } from '../clients/memoryManagerClient.js';

import type {
  ConversationContext,
  EmotionState,
  ListenerResult,
  ResponseGuidance,
  RoutineReminder,
  SuggestedActivity,
  HealthSummary,
} from './types.js';

type ReminderCategory = NonNullable<RoutineReminder['category']>;

const REMINDER_KEYWORDS: Array<{ category: ReminderCategory; patterns: RegExp[] }> = [
  {
    category: 'medication',
    patterns: [/\bмедик/i, /\bліки/i, /\bпігул/i, /\btablet/i, /\bpill/i, /\binsulin/i],
  },
  {
    category: 'hydration',
    patterns: [/\bwater/i, /\bвода/i, /гідрат/i, /drink/i, /чай/i],
  },
  {
    category: 'movement',
    patterns: [/прогуля/i, /walk/i, /stretch/i, /зарядк/i, /exercise/i, /рух/i],
  },
  {
    category: 'social',
    patterns: [/call/i, /подзвон/i, /зустр/i, /зателеф/i, /friend/i, /ону/i],
  },
  {
    category: 'wellness',
    patterns: [/breath/i, /диха/i, /релакс/i, /sleep/i, /сон/i, /mindful/i],
  },
];

export function extractPreferredName(profile?: Record<string, unknown>): string | undefined {
  if (!profile) return undefined;
  const directCandidates = [
    profile.preferredName,
    profile.preferred_name,
    profile.name,
    profile.fullName,
    profile.full_name,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  const demographics = typeof profile.demographics === 'object' ? (profile.demographics as Record<string, unknown>) : undefined;
  if (demographics) {
    const fallback = demographics.nickname ?? demographics.first_name ?? demographics.given_name;
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback.trim();
    }
  }
  return undefined;
}

function topMemoryTexts(entries: MemoryEntry[], limit: number): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const entry of entries) {
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text || seen.has(text)) continue;
    seen.add(text);
    results.push(text);
    if (results.length >= limit) break;
  }
  return results;
}

function categorizeReminder(text: string): ReminderCategory | undefined {
  for (const candidate of REMINDER_KEYWORDS) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return candidate.category;
    }
  }
  if (/\broutine\b/i.test(text) || /щоденн/i.test(text)) {
    return 'general';
  }
  return undefined;
}

function buildReminderCandidates(goals: MemoryEntry[], facts: MemoryEntry[]): RoutineReminder[] {
  const candidates: RoutineReminder[] = [];
  const pool = [...goals, ...facts];
  for (const entry of pool) {
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) continue;
    const category = categorizeReminder(text);
    if (!category) continue;
    const metadata =
      entry.metadata && typeof entry.metadata === 'object'
        ? (entry.metadata as Record<string, unknown>)
        : undefined;
    const scheduled = typeof metadata?.scheduled_at === 'string' ? metadata.scheduled_at : undefined;
    const timeFallback = typeof metadata?.time === 'string' ? metadata.time : undefined;
    candidates.push({
      title: text,
      details: typeof metadata?.note === 'string' ? metadata.note : undefined,
      category,
      importance: entry.importance,
      suggestedTime: scheduled ?? timeFallback,
    });
  }
  // Deduplicate by title
  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 3);
}

function pickPersonReference(facts: MemoryEntry[]): string | undefined {
  return facts
    .map((fact) => fact.text)
    .filter((text): text is string => Boolean(text))
    .find((text) => /подруг|friend|син|доньк|ону|сусід/i.test(text));
}

function buildActivitySuggestions(
  context: ConversationContext,
  listener: ListenerResult,
): SuggestedActivity[] {
  const activities: SuggestedActivity[] = [];
  const mind = context.mindBehaviorState;

  if (mind?.domains) {
    for (const domain of mind.domains) {
      if (domain.status === 'declining') {
        if (domain.domain === 'social') {
          const person = pickPersonReference(context.facts);
          activities.push({
            title: person ? `Подзвони ${person}` : 'Короткий дзвінок до близької людини',
            description: 'Тепла розмова допоможе почуватися менш самотньо.',
            category: 'social',
            reason: 'Соціальні сигнали знизилися у Mind & Behavior engine.',
          });
        } else if (domain.domain === 'self_care') {
          activities.push({
            title: 'Нагадування про самоопіку',
            description: 'Спробуй випити склянку води або перекусити чимось легким.',
            category: 'self_care',
            reason: 'Routine & self-care score просів.',
          });
        } else if (domain.domain === 'emotional') {
          activities.push({
            title: 'Коротка дихальна вправа',
            description: '3 повільні вдихи та видихи, щоб заземлитися.',
            category: 'mind',
            reason: 'Емоційний стан крихкий.',
          });
        }
      }
    }
  }

  const intents = listener.intents?.map((value) => value.toLowerCase()) ?? [];
  if (intents.some((intent) => intent.includes('walk') || intent.includes('прогуля'))) {
    activities.push({
      title: 'План короткої прогулянки',
      description: '5-хвилинна прогулянка після розмови, якщо відчуваєш сили.',
      category: 'movement',
      reason: 'Користувач згадав про прогулянку.',
    });
  }

  if (!activities.length && context.goals.some((goal) => /exercise|рух/i.test(goal.text ?? ''))) {
    activities.push({
      title: 'Розтяжка чи легкі рухи',
      description: 'Можна потягнутися або покрутити плечима впродовж однієї хвилини.',
      category: 'movement',
      reason: 'У цілях згадувалася фізична активність.',
    });
  }

  return activities.slice(0, 3);
}

function buildHealthSummary(context: ConversationContext): HealthSummary | null {
  const vitalsAtRisk: string[] = [];
  const lifestyleNotes: string[] = [];
  const recommendations: string[] = [];

  context.physicalState?.vitals.forEach((vital) => {
    if (vital.risk === 'high') {
      vitalsAtRisk.push(`${vital.label}: ${vital.value}${vital.unit}`);
    }
  });

  context.physicalState?.lifestyle.forEach((metric) => {
    if (metric.risk && metric.risk !== 'low') {
      lifestyleNotes.push(`${metric.label}: ${metric.value}${metric.unit}`);
      if (metric.metric === 'steps') {
        recommendations.push('Додай легку прогулянку для руху.');
      }
      if (metric.metric === 'sleep') {
        recommendations.push('Підготуйся до сну трохи раніше сьогодні.');
      }
    }
  });

  const mindConcerns =
    context.mindBehaviorState?.domains.filter((domain) => domain.status === 'declining') ?? [];
  mindConcerns.forEach((domain) => {
    recommendations.push(`Підтримай сферу "${domain.label.toLowerCase()}" якимось теплим кроком.`);
  });

  if (!vitalsAtRisk.length && !lifestyleNotes.length && !mindConcerns.length) {
    return null;
  }

  const summaryParts: string[] = [];
  if (vitalsAtRisk.length) {
    summaryParts.push(`Показники ${vitalsAtRisk[0]} потребують уваги.`);
  }
  if (lifestyleNotes.length) {
    summaryParts.push(`Рівень активності виглядає ${context.physicalState?.summary ?? 'трохи нижчим'}.`);
  }
  if (mindConcerns.length) {
    summaryParts.push('Настрій або соціальні сигнали теж просіли.');
  }

  const overallRisk: HealthSummary['overallRisk'] =
    vitalsAtRisk.length > 0 || mindConcerns.length > 0 ? 'high' : 'medium';

  return {
    summary: summaryParts.join(' '),
    overallRisk,
    vitalsAtRisk,
    lifestyleNotes,
    recommendations: recommendations.slice(0, 3),
  };
}

function buildPlanningCues(reminders: RoutineReminder[], activities: SuggestedActivity[]): string[] {
  const cues = new Set<string>();
  reminders.forEach((reminder) => {
    if (reminder.title) cues.add(reminder.title);
  });
  activities.forEach((activity) => {
    if (activity.title) cues.add(activity.title);
  });
  return Array.from(cues).slice(0, 3);
}

function buildSocialTopics(facts: MemoryEntry[], gratitude: MemoryEntry[]): string[] {
  const combined = [...facts, ...gratitude];
  const topics = new Set<string>();
  combined.forEach((entry) => {
    if (!entry.text) return;
    if (/grand|ону|внук|daughter|син|подруг|сусід/i.test(entry.text)) {
      topics.add(entry.text);
    }
  });
  return Array.from(topics).slice(0, 3);
}

export function buildResponseGuidance({
  context,
  listener,
  emotion,
}: {
  context: ConversationContext;
  listener: ListenerResult;
  emotion: EmotionState;
}): ResponseGuidance {
  const reminders = buildReminderCandidates(context.goals, context.facts);
  const activities = buildActivitySuggestions(context, listener);
  const healthSummary = buildHealthSummary(context);

  const identityFacts = topMemoryTexts(context.facts, 3);
  const gratitudeHighlights = topMemoryTexts(context.gratitude, 2);

  return {
    preferredName: extractPreferredName(context.profile),
    identityFacts,
    gratitudeHighlights,
    reminders,
    suggestedActivities: activities,
    healthSummary,
    planningCues: buildPlanningCues(reminders, activities),
    socialTopics: buildSocialTopics(context.facts, context.gratitude),
    personalizationNote:
      identityFacts.length > 0
        ? `Нагадай про ${identityFacts[0].toLowerCase()} і звертайся м’яко.`
        : emotion.socialNeed === 'wants_connection'
          ? 'Зроби теплий відкритий запит, чи хоче поговорити про когось близького.'
          : undefined,
  };
}
