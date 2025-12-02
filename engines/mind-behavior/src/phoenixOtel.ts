import { register } from '@arizeai/phoenix-otel';

let initialized = false;

export function initPhoenixOtel(serviceName = 'mind-behavior-engine'): void {
  if (initialized) return;

  const projectName = process.env.PHOENIX_PROJECT_NAME ?? 'Carelink';
  const url = process.env.PHOENIX_ENDPOINT ?? 'http://localhost:6006';
  const apiKey = process.env.PHOENIX_API_KEY;

  try {
    register({ projectName, url, apiKey, serviceName });
    initialized = true;
    console.log(
      `[Phoenix OTEL] Registered service "${serviceName}" for project "${projectName}" at ${url}`,
    );
  } catch (error) {
    console.warn('[Phoenix OTEL] Failed to register tracing', error);
  }
}
