const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';
const API_URL = `${BASE_URL.replace(/\/$/, '')}/api`;

const auth = {
  token: process.env.API_TOKEN ?? 'test-token',
  userId: process.env.API_USER_ID ?? 'user_123',
  deviceId: process.env.API_DEVICE_ID ?? 'device_abc456',
  clientVersion: process.env.API_CLIENT_VERSION ?? 'cl1',
};

const headers = {
  Authorization: `Bearer ${auth.token}`,
  'X-User-Id': auth.userId,
  'X-Device-Id': auth.deviceId,
  'X-Client-Version': auth.clientVersion,
};

const logBlock = (title, data) => {
  console.log(`\n=== ${title} ===`);
  console.dir(data, { depth: null, colors: true });
};

const assertOk = async (response) => {
  if (!response.ok) {
    let details = {};
    try {
      details = await response.json();
    } catch {
      // ignore
    }
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(details)}`);
  }
  return response.json();
};

try {
  const healthRes = await fetch(`${BASE_URL}/healthz`);
  const health = await assertOk(healthRes);
  logBlock('Health Check', health);
} catch (error) {
  console.error('\nHealth check failed:', error.message);
}

let sessionId = null;

try {
  const body = {
    locale: 'uk-UA',
    capabilities: {
      audioFormat: 'audio/webm;codecs=opus',
      supportsText: true,
      wantsProactiveGreeting: true,
    },
    context: {
      timezone: 'Europe/Kyiv',
      entryPoint: 'daily_ritual',
    },
  };

  const response = await fetch(`${API_URL}/start-conversation`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await assertOk(response);
  sessionId = payload.sessionId;
  logBlock('Start Conversation', payload);
} catch (error) {
  console.error('\nStart conversation failed:', error.message);
}

if (sessionId) {
  try {
    const utteranceResponse = await fetch(`${API_URL}/user-utterance`, {
      method: 'POST',
      headers: {
        ...headers,
        'X-Session-Id': sessionId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: 'Hello, could we plan a short walk after lunch?',
        metadata: {
          durationMs: 2300,
        },
      }),
    });

    const payload = await assertOk(utteranceResponse);
    logBlock('User Utterance', payload);
  } catch (error) {
    console.error('\nUser utterance failed:', error.message);
  }

  try {
    const summaryResponse = await fetch(
      `${API_URL}/session-summary?` + new URLSearchParams({ sessionId }),
      {
        headers,
      },
    );

    const payload = await assertOk(summaryResponse);
    logBlock('Session Summary', payload);
  } catch (error) {
    console.error('\nSession summary failed:', error.message);
  }
} else {
  console.warn('\nSkipping utterance + summary calls because sessionId is unavailable.');
}
