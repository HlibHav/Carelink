import cors from 'cors';
import express from 'express';
import { randomInt } from 'node:crypto';

import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 4102);
const app = express();
app.use(cors());
app.use(express.json());

type Domain = 'emotional' | 'cognitive' | 'social' | 'self_care';

interface DomainConfig {
  label: string;
  baseline: number;
  variance: number;
  description: string;
}

const domainConfig: Record<Domain, DomainConfig> = {
  emotional: {
    label: 'Emotional State',
    baseline: 0.72,
    variance: 0.18,
    description: 'Mood stability derived from conversations and check-ins.',
  },
  cognitive: {
    label: 'Cognitive State',
    baseline: 0.63,
    variance: 0.12,
    description: 'Working memory + orientation from periodic exercises.',
  },
  social: {
    label: 'Social Connectedness',
    baseline: 0.55,
    variance: 0.22,
    description: 'Contact graph activity + loneliness check-ins.',
  },
  self_care: {
    label: 'Routine & Self-Care',
    baseline: 0.68,
    variance: 0.18,
    description: 'Medication adherence, hygiene, chores, independence markers.',
  },
};

const randomFn = (seed: string) => {
  let value = 0;
  for (const ch of seed) {
    value = (value + ch.charCodeAt(0) * 17) % 8191;
  }
  return () => {
    value = (value * 53 + 19) % 8191;
    return value / 8191;
  };
};

const buildDomainScore = (userId: string, domain: Domain) => {
  const cfg = domainConfig[domain];
  const rand = randomFn(`${userId}_${domain}`);
  const raw = cfg.baseline + (rand() - 0.5) * cfg.variance * 2;
  const score = Math.min(1, Math.max(0, Number(raw.toFixed(2))));
  let status: 'steady' | 'watch' | 'declining' = 'steady';
  if (score < 0.4) {
    status = 'declining';
  } else if (score < 0.55) {
    status = 'watch';
  }
  return {
    domain,
    label: cfg.label,
    score,
    status,
    description: cfg.description,
    reasoning: status === 'steady' ? 'Signals are within baseline window.' : 'Sequence deviates from baseline.',
    recommendations:
      domain === 'social'
        ? ['Encourage conversation about recent connections.', 'Suggest a low-effort outreach.']
        : domain === 'self_care'
          ? ['Check-in on medication routine.', 'Offer a gentle reminder around hydration.']
          : domain === 'emotional'
            ? ['Validate feelings before coaching.', 'Offer grounding exercises if requested.']
            : ['Offer a light cognitive task or game.', 'Ask about recent focus challenges.'],
  };
};

const buildState = (userId: string) => {
  const domains = (Object.keys(domainConfig) as Domain[]).map((domain) => buildDomainScore(userId, domain));
  const highestRisk = domains.find((domain) => domain.status === 'declining')?.domain ?? null;
  return {
    userId,
    generatedAt: new Date().toISOString(),
    summary:
      highestRisk === 'emotional'
        ? 'Emotional state fragile – emphasize empathy.'
        : highestRisk === 'cognitive'
          ? 'Cognitive fatigue detected – keep instructions simple.'
          : highestRisk === 'social'
            ? 'Loneliness signals rising – encourage outreach.'
            : highestRisk === 'self_care'
              ? 'Routine adherence slipping – set micro-goals.'
              : 'Mind & behavior signals steady.',
    domains,
  };
};

const buildHistory = (userId: string, domain: Domain, window = 10) => {
  const cfg = domainConfig[domain];
  const rand = randomFn(`${userId}_${domain}_history`);
  const points = [];
  for (let day = window - 1; day >= 0; day -= 1) {
    const drift = (rand() - 0.5) * cfg.variance;
    const score = Math.min(1, Math.max(0, Number((cfg.baseline + drift).toFixed(2))));
    points.push({
      dayOffset: -day,
      score,
    });
  }
  return points;
};

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'mind-behavior-engine', time: new Date().toISOString() });
});

app.get('/state/:userId', (req, res) => {
  res.json(buildState(req.params.userId));
});

app.get('/history/:userId/:domain', (req, res) => {
  const domain = req.params.domain as Domain;
  if (!domainConfig[domain]) {
    res.status(400).json({ error: `Unknown domain ${domain}` });
    return;
  }
  const window = Math.min(Math.max(Number(req.query.window ?? 14), 5), 60);
  res.json({
    userId: req.params.userId,
    domain,
    windowDays: window,
    points: buildHistory(req.params.userId, domain, window),
  });
});

app.get('/alerts/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  });

  const interval = setInterval(() => {
    const domains = Object.keys(domainConfig) as Domain[];
    const event = {
      event_id: `evt_mb_${randomInt(10_000)}`,
      user_id: `demo_${randomInt(100)}`,
      domain: domains[randomInt(domains.length)],
      severity: ['info', 'warning', 'critical'][randomInt(3)],
      observed_at: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }, 20_000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.listen(port, () => {
  console.log(`Mind & Behavior Engine listening on port ${port}`);
});
