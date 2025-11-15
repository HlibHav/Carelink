type TopicName = string;

interface EventRecord {
  id: string;
  payload: Record<string, unknown>;
  publishedAt: string;
}

const maxEventsPerTopic = Number(process.env.EVENT_BUS_MAX_EVENTS ?? 100);

const topicEvents = new Map<TopicName, EventRecord[]>();

export function recordEvent(topic: TopicName, event: EventRecord) {
  if (!topicEvents.has(topic)) {
    topicEvents.set(topic, []);
  }
  const list = topicEvents.get(topic)!;
  list.push(event);
  if (list.length > maxEventsPerTopic) {
    list.shift();
  }
}

export function getEventsSince(topic: TopicName, sinceId?: string): EventRecord[] {
  const list = topicEvents.get(topic) ?? [];
  if (!sinceId) {
    return list;
  }
  const index = list.findIndex((e) => e.id === sinceId);
  if (index === -1) {
    return list;
  }
  return list.slice(index + 1);
}
