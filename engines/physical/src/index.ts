import cors from 'cors';
import express from 'express';
import type { Request } from 'express';
import { randomInt } from 'node:crypto';

import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT ?? 4101);

type MetricName = 'heart_rate' | 'hrv' | 'spo2' | 'respiration' | 'temperature' | 'steps' | 'sleep';

const metricConfig: Record<
  MetricName,
  { unit: string; baseline: number; variance: number; label: string; lowerBound?: number }
> = {
  heart_rate: { label: 'Heart Rate', unit: 'bpm', baseline: 76, variance: 12 },
  hrv: { label: 'HRV', unit: 'ms', baseline: 48, variance: 15, lowerBound: 20 },
  spo2: { label: 'SpO2', unit: '%', baseline: 97, variance: 2, lowerBound: 88 },
  respiration: { label: 'Respiration', unit: 'rpm', baseline: 15, variance: 3 },
  temperature: { label: 'Skin Temperature', unit: '°C', baseline: 36.4, variance: 0.4 },
  steps: { label: 'Daily Steps', unit: 'count', baseline: 5200, variance: 2100, lowerBound: 0 },
  sleep: { label: 'Sleep Duration', unit: 'hr', baseline: 7.1, variance: 1.2, lowerBound: 0 },
};

const stableRandom = (seed: string) => {
  let value = 0;
  for (const char of seed) {
    value = (value + char.charCodeAt(0) * 13) % 9973;
  }
  return () => {
    value = (value * 37 + 17) % 9973;
    return value / 9973;
  };
};

const summarizeMetric = (userId: string, metric: MetricName) => {
  const cfg = metricConfig[metric];
  const rand = stableRandom(`${userId}_${metric}`);
  const delta = (rand() - 0.5) * cfg.variance * 2;
  const value = Math.max(cfg.lowerBound ?? -Infinity, Number((cfg.baseline + delta).toFixed(2)));
  const trend = delta > 2 ? 'rising' : delta < -2 ? 'falling' : 'stable';
  let risk: 'low' | 'medium' | 'high' = 'low';
  if (Math.abs(delta) > cfg.variance * 0.8) {
    risk = 'high';
  } else if (Math.abs(delta) > cfg.variance * 0.4) {
    risk = 'medium';
  }
  return {
    metric,
    label: cfg.label,
    value,
    unit: cfg.unit,
    baseline: cfg.baseline,
    trend,
    risk,
  };
};

const buildState = (userId: string) => {
  const metrics = (Object.keys(metricConfig) as MetricName[]).map((name) => summarizeMetric(userId, name));
  const riskCounts = metrics.reduce(
    (acc, metric) => {
      acc[metric.risk] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 },
  );
  const summary =
    riskCounts.high > 0
      ? 'High-risk vitals detected – recommend safety check-in.'
      : riskCounts.medium > 1
        ? 'Monitor trends – consider coach follow-up.'
        : 'Vitals look stable.';
  return {
    userId,
    generatedAt: new Date().toISOString(),
    summary,
    vitals: metrics.filter((metric) => ['heart_rate', 'hrv', 'spo2', 'respiration', 'temperature'].includes(metric.metric)),
    lifestyle: metrics.filter((metric) => ['steps', 'sleep'].includes(metric.metric)),
  };
};

const buildTrendSeries = (userId: string, metric: MetricName, window: number) => {
  const cfg = metricConfig[metric];
  const rand = stableRandom(`${userId}_${metric}_trend`);
  const series = [];
  for (let day = window - 1; day >= 0; day -= 1) {
    const drift = (rand() - 0.5) * cfg.variance;
    const point = Number((cfg.baseline + drift + day * 0.2).toFixed(2));
    series.push({
      dayOffset: -day,
      value: Math.max(cfg.lowerBound ?? -Infinity, point),
    });
  }
  return series;
};

const parseMetric = (req: Request): MetricName => {
  const metric = req.params.metric as MetricName;
  if (!metricConfig[metric]) {
    throw new Error(`Unknown metric "${metric}"`);
  }
  return metric;
};

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'physical-engine', time: new Date().toISOString() });
});

app.get('/state/:userId', (req, res) => {
  const { userId } = req.params;
  res.json(buildState(userId));
});

app.get('/trends/:userId/:metric', (req, res) => {
  try {
    const { userId } = req.params;
    const metric = parseMetric(req);
    const windowDays = Number(req.query.window ?? 7);
    const data = buildTrendSeries(userId, metric, Math.min(Math.max(windowDays, 3), 30));
    res.json({
      userId,
      metric,
      windowDays,
      points: data,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/alerts/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  });

  const interval = setInterval(() => {
    const severity: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];
    const metricKeys = Object.keys(metricConfig) as MetricName[];
    const event = {
      event_id: `evt_${randomInt(10_000)}`,
      user_id: `demo_${randomInt(100)}`,
      severity: severity[randomInt(severity.length)],
      source: metricKeys[randomInt(metricKeys.length)],
      observed_at: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }, 15_000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.listen(port, () => {
  console.log(`Physical Health Engine listening on port ${port}`);
});
